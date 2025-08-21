exports.up = function(knex) {
  return knex.schema.createTable('import_batches', function(table) {
    table.increments('id').primary();
    table.string('filename').notNullable();
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
    table.integer('total_rows');
    table.integer('imported_rows');
    table.integer('conflict_rows');
    table.integer('created_by').references('id').inTable('users').notNullable();
    table.json('mapping_config');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('import_batches');
};

