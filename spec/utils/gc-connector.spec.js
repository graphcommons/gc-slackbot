'use strict';

import graphCommonsConnector from '../../utils/gc-connector';
import memStorage from '../../utils/mem-storage';

describe('testing gc-connector', () => {

  describe('testing initial data load', () => {
    it ('should parse the channel membership data from Graph Commons', (done) => {
      const storage = memStorage();
      const gcConnector = graphCommonsConnector({
        storage: storage
      });

      const initialData = {
        nodes: [
          {
            id: '1',
            name: 'first user',
            type: 'User',
            type_id: '1',
            properties: {
              user_id: 'U1'
            }
          },
          {
            id: '2',
            name: 'first channel',
            type: 'Channel',
            type_id: '2',
            properties: {
              channel_id: 'C1'
            }
          },
          {
            id: '3',
            name: 'second channel',
            type: 'Channel',
            type_id: '2',
            properties: {
              channel_id: 'C2'
            }
          }
        ],
        edges: [
          {
            id: '4',
            name: 'MEMBER_OF',
            name_id: '5',
            from: '1',
            to: '2'
          },
          {
            id: '5',
            name: 'MEMBER_OF',
            name_id: '5',
            from: '1',
            to: '3'
          }
        ]
      };

      const checker = function() {
        expect(storage.users.getSync('U1').channels).toEqual(['C1', 'C2'])
        done();
      };

      gcConnector.loadInitialData(initialData).then(checker)
    });
  });

  describe('test synchronizing data', () => {

    describe('testing user synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          users: {
            'U1': {
              id: 'U1',
              name: 'first user',
              gc_id: '1'
            }
          }
        });

        const graphCache = {
          users: {
            '1': 'U1'
          },
          channels: {},
          edges: {
            "MEMBER_OF": {}
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it('should return node_create signals for each new Users', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'node_create',
            type: 'User',
            name: 'second user',
            image: 'img_u2.jpg',
            properties: {
              user_id: 'U2'
            }
          });
          done();
        };

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          },
          {
            id: 'U2',
            name: 'second user',
            profile: {
              image_192: 'img_u2.jpg'
            }
          }
        ];

        const newChannels = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it('should not return any node_create signals if there are no new Users', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(0);
          done();
        };

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        const newChannels = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

    });

    describe('testing channel synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '1'
            }
          }
        });

        const graphCache = {
          users: {},
          channels: {
            'C1': '1'
          },
          edges: {
            "MEMBER_OF": {}
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it('should return node_create signals for each new Channels', (done) => {

        const checker = function (signals) {

          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'node_create',
            type: 'Channel',
            name: 'second channel',
            properties: {
              channel_id: 'C2'
            }
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should not return any node_create signal if there are no new Channels', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(0);
          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });
    });

    describe('testing membership synchronization', () => {
      let gcConnector;

      beforeEach(() => {
        const storage = memStorage({
          channels: {
            'C1': {
              id: 'C1',
              name: 'first channel',
              gc_id: '2'
            },
            'C2': {
              id: 'C2',
              name: 'second channel',
              gc_id: '3'
            }
          },
          users: {
            'U1': {
              id: 'U1',
              name: 'first user',
              gc_id: '1',
              channels: ['C1']
            }
          }
        });

        const graphCache = {
          users: {
            'U1': '1'
          },
          channels: {
            'C1': '2',
            'C2': '3'
          },
          edges: {
            'MEMBER_OF': {
              '1-2': '4'
            }
          }
        };

        gcConnector = graphCommonsConnector({
          storage: storage,
          cache: graphCache,
          graphId: 'my graph id'
        });
      });

      it ('should return edge_create signal if a new channel membership exists', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'edge_create',
            name: 'MEMBER_OF',
            from_type: 'User',
            from_name: 'first user',
            to_type: 'Channel',
            to_name: 'second channel',
            properties: {}
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: [
              'U1'
            ]
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: [
              'U1'
            ]
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should return edge_delete signal if a channel membership no longer exists', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(1);
          expect(signals[0]).toEqual({
            action: 'edge_delete',
            name: 'MEMBER_OF',
            id: '4',
            from: '1',
            to: '2'
          });

          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: []
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });

      it ('should not return any signals if channel membership data is the same', (done) => {

        const checker = function (signals) {
          expect(signals.length).toBe(0);
          done();
        };

        const newChannels = [
          {
            id: 'C1',
            name: 'first channel',
            is_member: true,
            members: ['U1']
          },
          {
            id: 'C2',
            name: 'second channel',
            is_member: true,
            members: []
          }
        ];

        const newUsers = [
          {
            id: 'U1',
            name: 'first user',
            profile: {
              image_192: 'img_u1.jpg'
            }
          }
        ];

        gcConnector.buildTeamDataSynchronizeSignals(newUsers, newChannels).then(checker);
      });
    });
  });

  describe('test channel join', () => {
    let storage;
    let mockScheduler;

    beforeEach(() => {

      mockScheduler = {
        addJob: jasmine.createSpy('addJob')
      };

      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            gc_id: '1'
          }
        },
        channels: {
          'C1': {
            id: 'C1',
            name: 'first channel',
            gc_id: '2'
          }
        }
      });

      const graphCache = {
        users: {
          '1': 'U1'
        },
        channels: {
          '2': 'C1'
        },
        edges: {
          "MEMBER_OF": {}
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: function() {
          return mockScheduler;
        }
      });

      gcConnector.onUserJoinedChannel({
        user: 'U1',
        channel: 'C1'
      });
    });

    it('should add channel id to member channels', (done) => {
      expect(storage.users.getSync('U1').channels).toEqual(['C1']);
      done();
    });

    it('should create edge_create signal from user to channel', (done) => {
      expect(mockScheduler.addJob).toHaveBeenCalledWith({
        action: 'edge_create',
        name: 'MEMBER_OF',
        from_type: 'User',
        from_name: 'first user',
        to_type: 'Channel',
        to_name: 'first channel'
      });
      done();
    });
  });

  describe('test channel leave', () => {
    let storage;
    let mockScheduler;
    let graphCache;

    beforeEach(() => {

      mockScheduler = {
        addJob: jasmine.createSpy('addJob')
      };

      storage = memStorage({
        users: {
          'U1': {
            id: 'U1',
            name: 'first user',
            gc_id: '1',
            channels: [
              'C1'
            ]
          }
        },
        channels: {
          'C1': {
            id: 'C1',
            name: 'first channel',
            gc_id: '2'
          }
        }
      });

      graphCache = {
        users: {
          '1': 'U1'
        },
        channels: {
          '2': 'C1'
        },
        edges: {
          "MEMBER_OF": {
            '1-2': '4'
          }
        }
      };

      const gcConnector = graphCommonsConnector({
        storage: storage,
        cache: graphCache,
        graphId: 'my graph id',
        jobQueue: function() {
          return mockScheduler;
        }
      });

      gcConnector.onUserLeftChannel({
        user: 'U1',
        channel: 'C1'
      });
    });

    it('should remove channel id from member channels', (done) => {
      expect(storage.users.getSync('U1').channels).toEqual([]);
      done();
    });

    it('should create edge_delete signal from user to channel', (done) => {
      expect(mockScheduler.addJob).toHaveBeenCalledWith({
        action: 'edge_delete',
        name: 'MEMBER_OF',
        id: '4',
        from: '1',
        to: '2'
      });
      done();
    });
  });

});
