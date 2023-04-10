import BaseService from "./baseService";

class RoleService extends BaseService {
  constructor() {
    super("roles");
  }

  invite = (token) => {
    return this.request.get(this.action("invite"), { params: { token } });
  };
}

export const roleService = new RoleService();
