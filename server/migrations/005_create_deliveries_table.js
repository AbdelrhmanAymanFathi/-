exports.up = function(knex) {
  return knex.schema.createTable('deliveries', function(table) {
    table.increments('id').primary();
    table.date('date').notNullable();
    table.integer('contractor_id').references('id').inTable('contractors');
    table.integer('supplier_id').references('id').inTable('suppliers');
    table.string('vehicle_no');
    table.string('company_voucher_no');
    table.decimal('volume', 15, 3);
    table.string('unit');
    table.decimal('unit_price', 15, 2);
    table.decimal('gross_value', 15, 2);
    table.decimal('discount', 15, 2).defaultTo(0);
    table.decimal('net_value', 15, 2);
    table.text('item_description');
    table.string('source_sheet');
    table.integer('original_row_index');
    table.integer('created_by').references('id').inTable('users').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes for better performance
    table.index(['date']);
    table.index(['contractor_id']);
    table.index(['supplier_id']);
    table.index(['vehicle_no']);
    table.index(['company_voucher_no']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('deliveries');
};

