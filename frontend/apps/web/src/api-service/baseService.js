import { request } from "./httpRequest";

export default class BaseService {
  constructor(path) {
    this.path = path;
    this.request = request;
  }
  get base() {
    return `${this.path}/`;
  }
  detail(id) {
    return `${this.path}/${id}/`;
  }
  action(action) {
    return `${this.path}/${action}/`;
  }
  detailAction(id, action) {
    return `${this.path}/${id}/${action}/`;
  }
  // viewset method
  create(obj) {
    return this.request.post(this.base, obj);
  }
  list() {
    return this.request.get(this.base);
  }
  retrieve(id) {
    return this.request.get(this.detail(id));
  }
  delete(id) {
    return this.request.delete(this.detail(id));
  }
  update(id, obj) {
    return this.request.put(this.detail(id), obj);
  }
  partial_update(id, obj) {
    return this.request.patch(this.detail(id), obj);
  }
}
