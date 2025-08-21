exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', function(table) {
    table.increments('id').primary();
    table.integer('user_id').references('id').inTable('users').notNullable();
    table.enum('action', ['create', 'update', 'delete', 'import', 'login', 'logout']).notNullable();
    table.string('table_name');
    table.integer('record_id');
    table.json('changes');
    table.string('ip_address');
    table.string('user_agent');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Indexes for better performance
    table.index(['user_id']);
    table.index(['action']);
    table.index(['table_name']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};

