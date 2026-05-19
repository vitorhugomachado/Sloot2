const bcrypt = require('bcryptjs');

const hash = '$2b$10$nUQq7gil7mUURFutQHdQ0eOe7mX9oEpcppj/eJFYs6x//iKRekENC';
const password = 'admin';

bcrypt.compare(password, hash).then(res => {
  console.log('Match:', res);
});
