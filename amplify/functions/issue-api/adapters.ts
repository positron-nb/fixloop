/** AWS adapters for the issue service: S3 photo inspection and the Cognito staff directory. */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ListUsersInGroupCommand,
  UsernameExistsException,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DEPARTMENTS, isDepartmentCode } from '../../../shared/catalog';
import type { Directory, PhotoInspector } from './repo';

export class S3PhotoInspector implements PhotoInspector {
  private s3 = new S3Client({});
  constructor(private bucket: string) {}

  async inspect(key: string) {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, size: head.ContentLength, contentType: head.ContentType };
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || status === 403) return { exists: false };
      throw e;
    }
  }
}

const attr = (u: UserType | undefined, name: string) => u?.Attributes?.find((a) => a.Name === name)?.Value;

export class CognitoDirectory implements Directory {
  private idp = new CognitoIdentityProviderClient({});
  private names = new Map<string, string | undefined>();
  constructor(private userPoolId: string) {}

  async displayName(username: string) {
    if (this.names.has(username)) return this.names.get(username);
    try {
      const u = await this.idp.send(new AdminGetUserCommand({ UserPoolId: this.userPoolId, Username: username }));
      const name = u.UserAttributes?.find((a) => a.Name === 'name')?.Value;
      const email = u.UserAttributes?.find((a) => a.Name === 'email')?.Value;
      const display = name || email?.split('@')[0];
      this.names.set(username, display);
      return display;
    } catch {
      return undefined;
    }
  }

  async inviteStaff(input: { email: string; name: string; department: string; makeAdmin: boolean }) {
    let username = input.email;
    let created = true;
    try {
      const res = await this.idp.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
          Username: input.email,
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: input.name },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );
      username = res.User?.Username ?? input.email;
    } catch (e) {
      if (!(e instanceof UsernameExistsException)) throw e;
      created = false;
    }
    const groups: string[] = [];
    if (isDepartmentCode(input.department)) groups.push('STAFF', DEPARTMENTS[input.department].group);
    if (input.makeAdmin) groups.push('ADMIN');
    for (const GroupName of groups) {
      await this.idp.send(new AdminAddUserToGroupCommand({ UserPoolId: this.userPoolId, Username: username, GroupName }));
    }
    return { username, created };
  }

  async listStaff() {
    const byUser = new Map<string, { username: string; email?: string; name?: string; groups: string[]; status?: string }>();
    const groups = ['ADMIN', 'STAFF', ...Object.values(DEPARTMENTS).map((d) => d.group)];
    for (const GroupName of groups) {
      let NextToken: string | undefined;
      do {
        const page = await this.idp.send(new ListUsersInGroupCommand({ UserPoolId: this.userPoolId, GroupName, NextToken, Limit: 60 }));
        for (const u of page.Users ?? []) {
          const key = u.Username!;
          const entry = byUser.get(key) ?? { username: key, email: attr(u, 'email'), name: attr(u, 'name'), groups: [], status: u.UserStatus };
          entry.groups.push(GroupName);
          byUser.set(key, entry);
        }
        NextToken = page.NextToken;
      } while (NextToken);
    }
    return [...byUser.values()].sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''));
  }
}
