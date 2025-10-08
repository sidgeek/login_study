const { MemoryService } = require('@feathersjs/memory');
const { hashPassword } = require('@feathersjs/authentication-local').hooks;

class UserService extends MemoryService {

}

module.exports = function (app) {
  app.use('/users', new UserService());

  app.service('users').hooks({
    before: {
      create: [ hashPassword('password') ],
      patch: [ hashPassword('password') ]
    }
  });

  app.service('users').create({
    email: 'test@example.com',
    password: 'password'
  });
};