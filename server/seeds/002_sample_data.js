exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('contractors').del();
  await knex('suppliers').del();
  await knex('vehicles').del();
  
  // Insert sample contractors
  const contractors = await knex('contractors').insert([
    { name: 'شركة المقاولات الأولى / First Contracting Co.' },
    { name: 'شركة البناء المتقدمة / Advanced Building Co.' },
    { name: 'مؤسسة الإنشاءات الحديثة / Modern Construction Foundation' }
  ]).returning('*');
  
  // Insert sample suppliers
  const suppliers = await knex('suppliers').insert([
    { name: 'مورد الخرسانة / Concrete Supplier' },
    { name: 'مورد الحديد / Steel Supplier' },
    { name: 'مورد الرمل / Sand Supplier' },
    { name: 'مورد الحجارة / Stone Supplier' }
  ]).returning('*');
  
  // Insert sample vehicles
  const vehicles = await knex('vehicles').insert([
    { vehicle_no: 'ABC-123' },
    { vehicle_no: 'XYZ-456' },
    { vehicle_no: 'DEF-789' }
  ]).returning('*');
  
  return { contractors, suppliers, vehicles };
};

