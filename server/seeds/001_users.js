const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  
  // Inserts seed entries
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  return knex('users').insert([
    {
      name: 'مدير النظام / System Manager',
      email: 'manager@company.com',
      password_hash: hashedPassword,
      role: 'manager'
    },
    {
      name: 'محاسب / Accountant',
      email: 'accountant@company.com',
      password_hash: hashedPassword,
      role: 'accountant'
    },
    {
      name: 'مدقق / Auditor',
      email: 'auditor@company.com',
      password_hash: hashedPassword,
      role: 'auditor'
    }
  ]);
};

