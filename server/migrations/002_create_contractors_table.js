exports.up = function(knex) {
  return knex.schema.createTable('contractors', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('contractors');
};

