exports.up = function(knex) {
  return knex.schema.createTable('import_conflicts', function(table) {
    table.increments('id').primary();
    table.integer('batch_id').references('id').inTable('import_batches').notNullable();
    table.integer('delivery_row');
    table.enum('reason', ['duplicate_voucher', 'mismatch_volume', 'missing_required', 'invalid_data', 'formula_error']).notNullable();
    table.text('details');
    table.json('original_data');
    table.json('suggested_fix');
    table.enum('status', ['pending', 'resolved', 'ignored']).defaultTo('pending');
    table.integer('resolved_by').references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('resolved_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('import_conflicts');
};

