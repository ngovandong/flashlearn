import { createAuthApi } from "@flashlearn/api";
import { request } from "./httpRequest";

// Web auth endpoints. `refresh`/`logout` use the HttpOnly refresh cookie
// (withCredentials), so no token is passed in the body.
const authService = createAuthApi(request);

export default authService;
