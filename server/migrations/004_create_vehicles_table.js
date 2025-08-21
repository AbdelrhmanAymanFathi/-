exports.up = function(knex) {
  return knex.schema.createTable('vehicles', function(table) {
    table.increments('id').primary();
    table.string('vehicle_no').unique().notNullable();
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('vehicles');
};

