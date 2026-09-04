import { createNoteApi } from "@flashlearn/api";

import { request } from "./httpRequest";

const noteService = createNoteApi(request);

export default noteService;
