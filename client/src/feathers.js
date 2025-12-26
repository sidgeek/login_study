import feathers from '@feathersjs/client';
import rest from '@feathersjs/rest-client';

const client = feathers();
const restClient = rest('http://localhost:3030');

// 使用带 credentials 的 fetch，以支持 HttpOnly Cookie
client.configure(restClient.fetch((url, options) => {
  return fetch(url, { ...options, credentials: 'include' });
}));

client.configure(feathers.authentication({
  storage: window.localStorage
}));

export default client;