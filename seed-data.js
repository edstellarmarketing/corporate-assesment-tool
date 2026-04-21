/**
 * seed-data.js — One-time seed script for initial platform data
 *
 * Open this file in the browser console, or include it temporarily in a page.
 * Run: await seedAll()
 *
 * Prerequisites:
 *   - Supabase URL + Anon Key configured in settings.html
 *   - All 25 v2- tables created in Supabase
 *   - An admin user created in Supabase Auth (email: admin@emaar.ae)
 */

async function seedAll() {
  const sb = getClient();
  if (!sb) { console.error('No Supabase client. Configure settings first.'); return; }

  console.log('Starting seed...');

  // ============ 1. ORGANIZATION ============
  console.log('[1/5] Seeding organization...');
  const { data: org, error: orgErr } = await sb
    .from('v2-organizations')
    .upsert({
      name: 'Emaar Properties',
      short_name: 'Emaar',
      domain: 'emaar.ae',
      industry: 'Real Estate & Hospitality',
      primary_color: '#c8410b',
      logo_url: 'Edstellar_Primary_Logo-1.png',
      passing_threshold: 70,
      certificate_prefix: 'EMAAR-CERT',
      signatory_name: 'Mohamed Alabbar',
      signatory_title: 'Chairman',
      created_at: new Date().toISOString()
    }, { onConflict: 'domain' })
    .select()
    .single();

  if (orgErr) { console.error('Org seed failed:', orgErr); return; }
  const orgId = org.id;
  console.log('  Org created:', orgId);

  // ============ 2. DEPARTMENTS ============
  console.log('[2/5] Seeding departments...');
  const deptNames = [
    'Customer Experience',
    'Engineering',
    'Data Science',
    'Operations',
    'Marketing',
    'Finance',
    'Human Resources'
  ];

  const { data: departments, error: deptErr } = await sb
    .from('v2-departments')
    .upsert(
      deptNames.map(name => ({ org_id: orgId, name })),
      { onConflict: 'org_id,name' }
    )
    .select();

  if (deptErr) { console.error('Dept seed failed:', deptErr); return; }
  console.log('  Departments created:', departments.length);

  // Build dept lookup
  const deptMap = {};
  departments.forEach(d => { deptMap[d.name] = d.id; });

  // ============ 3. PROGRAMMES ============
  console.log('[3/5] Seeding programmes...');
  const programmes = [
    { org_id: orgId, name: 'AI Foundations \u00b7 Emaar', description: 'Core AI literacy programme for all departments' },
    { org_id: orgId, name: 'Data Analytics Essentials', description: 'Fundamental data analysis and visualization skills' },
    { org_id: orgId, name: 'Python for Data Science', description: 'Hands-on Python programming for data professionals' },
    { org_id: orgId, name: 'Leadership & Change Management', description: 'Executive leadership and organizational change skills' }
  ];

  const { error: progErr } = await sb.from('v2-programmes').upsert(programmes, { onConflict: 'org_id,name' });
  if (progErr) console.warn('Programme seed warning:', progErr);
  else console.log('  Programmes created: 4');

  // ============ 4. USERS (admin + 7 employees) ============
  console.log('[4/5] Seeding users...');

  // Get the admin auth user (must be created in Supabase Auth first)
  // In this schema, v2-users.id IS the Supabase Auth uid
  const { data: { session } } = await sb.auth.getSession();
  const adminId = session?.user?.id || null;

  const users = [
    {
      id: adminId,
      org_id: orgId,
      first_name: 'Admin', last_name: 'User',
      email: 'admin@emaar.ae', employee_id: 'ADM-001',
      department_id: deptMap['Human Resources'], job_title: 'Platform Administrator',
      role: 'admin', status: 'active',
      join_date: '2023-01-15'
    },
    {
      org_id: orgId,
      first_name: 'Aisha', last_name: 'Khoury',
      email: 'aisha.khoury@emaar.ae', employee_id: 'EMP-001',
      department_id: deptMap['Customer Experience'], job_title: 'CX Lead',
      role: 'employee', status: 'active',
      join_date: '2023-03-20'
    },
    {
      org_id: orgId,
      first_name: 'Khalid', last_name: 'Al Mansouri',
      email: 'khalid.mansouri@emaar.ae', employee_id: 'EMP-002',
      department_id: deptMap['Engineering'], job_title: 'Senior Engineer',
      role: 'employee', status: 'active',
      join_date: '2023-02-10'
    },
    {
      org_id: orgId,
      first_name: 'Fatima', last_name: 'Al Zahra',
      email: 'fatima.zahra@emaar.ae', employee_id: 'EMP-003',
      department_id: deptMap['Data Science'], job_title: 'Data Analyst',
      role: 'employee', status: 'active',
      join_date: '2023-06-01'
    },
    {
      org_id: orgId,
      first_name: 'Omar', last_name: 'Hassan',
      email: 'omar.hassan@emaar.ae', employee_id: 'EMP-004',
      department_id: deptMap['Operations'], job_title: 'Operations Manager',
      role: 'employee', status: 'active',
      join_date: '2023-04-15'
    },
    {
      org_id: orgId,
      first_name: 'Layla', last_name: 'Mahmoud',
      email: 'layla.mahmoud@emaar.ae', employee_id: 'EMP-005',
      department_id: deptMap['Marketing'], job_title: 'Marketing Specialist',
      role: 'employee', status: 'active',
      join_date: '2023-05-22'
    },
    {
      org_id: orgId,
      first_name: 'Youssef', last_name: 'Ibrahim',
      email: 'youssef.ibrahim@emaar.ae', employee_id: 'EMP-006',
      department_id: deptMap['Finance'], job_title: 'Financial Analyst',
      role: 'employee', status: 'active',
      join_date: '2023-07-10'
    },
    {
      org_id: orgId,
      first_name: 'Sara', last_name: 'Al Rashid',
      email: 'sara.rashid@emaar.ae', employee_id: 'EMP-007',
      department_id: deptMap['Engineering'], job_title: 'Junior Developer',
      role: 'employee', status: 'active',
      join_date: '2024-01-08'
    }
  ];

  const { error: userErr } = await sb.from('v2-users').upsert(users, { onConflict: 'email' });
  if (userErr) console.warn('User seed warning:', userErr);
  else console.log('  Users created: 8 (1 admin + 7 employees)');

  // ============ 5. SETTINGS ============
  console.log('[5/5] Seeding default settings...');
  // value column is jsonb — wrap strings with JSON.stringify so they're valid jsonb
  const settingsRows = [
    { org_id: orgId, key: 'default_model', value: JSON.stringify('anthropic/claude-sonnet-4') },
    { org_id: orgId, key: 'route_grading', value: JSON.stringify('anthropic/claude-sonnet-4') },
    { org_id: orgId, key: 'route_code', value: JSON.stringify('deepseek/deepseek-chat-v3-0324') },
    { org_id: orgId, key: 'route_notes', value: JSON.stringify('anthropic/claude-sonnet-4') },
    { org_id: orgId, key: 'route_questions', value: JSON.stringify('openai/gpt-4o') },
    { org_id: orgId, key: 'route_fallback', value: JSON.stringify('anthropic/claude-haiku-4') },
    { org_id: orgId, key: 'max_tokens_grading', value: JSON.stringify('2048') },
    { org_id: orgId, key: 'temperature', value: JSON.stringify('0.3') },
    { org_id: orgId, key: 'rate_limit', value: JSON.stringify('20') },
    { org_id: orgId, key: 'retry_policy', value: JSON.stringify('3') }
  ];

  const { error: settErr } = await sb.from('v2-settings').upsert(settingsRows, { onConflict: 'org_id,key' });
  if (settErr) console.warn('Settings seed warning:', settErr);
  else console.log('  Settings created: 10 keys');

  console.log('Seed complete!');
  return { orgId, departments: deptMap };
}
