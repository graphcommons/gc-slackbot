'use strict';

function build(store) {
  return {
    get: (id, cb) => {
      if (store[id]) {
        cb(null, store[id]);
      }
      else {
        cb({
          msg: 'Not found'
        });
      }
    },
    save: (obj, cb) => {
      if (!obj.id) {
        cb({
          msg: 'Id is not specified'
        });
      }
      else {
        store[obj.id] = obj;
        cb();
      }
    },
    all: (cb) => {
      cb(null, Object.keys(store).map(k => store[k]));
    },
    getSync: (id) => {
      return store[id];
    }
  }
};

const storage = {
  teams: build({}),
  users: build({}),
  channels: build({})
};

export default storage;
