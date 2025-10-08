const cors = require('cors');
const { feathers } = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');
const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks;
const users = require('./users');

const app = express(feathers());

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.configure(express.rest());
app.configure(socketio({
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
}));

app.set('authentication', {
  secret: 'supersecret',
  entity: 'user',
  service: 'users',
  strategies: ['local', 'jwt'],
  authStrategies: ['local'],
  local: {
    usernameField: 'email',
    passwordField: 'password'
  }
});

const authentication = new AuthenticationService(app);

authentication.register('jwt', new JWTStrategy());
authentication.register('local', new LocalStrategy());

app.use('/authentication', authentication);

app.configure(users);

app.service('users').hooks({
  before: {
    create: [hashPassword('password')],
    find: [],
    get: [],
    patch: [hashPassword('password')],
    remove: []
  },
  after: {
    all: [protect('password')]
  }
});

app.use(express.errorHandler());

const port = 3030;
app.listen(port).then(() => {
  console.log(`Feathers server listening on port ${port}`);
});