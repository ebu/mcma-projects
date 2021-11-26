export interface UserProperties {
  name: string,
  email: string,
  groups?: string[],
}

export class User {
  name: string;
  email: string;
  groups: string[];

  constructor(properties: UserProperties) {
    this.name = properties.name;
    this.email = properties.email;
    this.groups = properties.groups ?? [];
  }
}
