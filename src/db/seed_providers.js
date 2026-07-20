const db = require('../config/db');

// NOTE: base_url values below are placeholders using {consumer_id} as the
// substitution token. Verify each provider's real, official bill-check URL
// before going live, and fill in selector_config once you've inspected the
// actual page structure (see docs/FLOWS.md, Flow 5).
const defaultProviders = [
  // Electricity DISCOs
  { name: 'LESCO',  category: 'electricity', region: 'Lahore, Kasur, Sheikhupura, Okara, Nankana Sahib', id_label: '14-digit Reference Number' },
  { name: 'FESCO',  category: 'electricity', region: 'Faisalabad, Jhang, Chiniot, Sargodha, Toba Tek Singh, Mianwali', id_label: '14-digit Reference Number' },
  { name: 'MEPCO',  category: 'electricity', region: 'Multan, D.G. Khan, Bahawalpur, Sahiwal, Khanewal, Vehari', id_label: '14-digit Reference Number' },
  { name: 'IESCO',  category: 'electricity', region: 'Islamabad, Rawalpindi, Attock, Jhelum, Chakwal', id_label: '14-digit Reference Number' },
  { name: 'GEPCO',  category: 'electricity', region: 'Gujranwala, Sialkot, Gujrat, Mandi Bahauddin, Narowal, Hafizabad', id_label: '14-digit Reference Number' },
  { name: 'PESCO',  category: 'electricity', region: 'Peshawar, Mardan, Swat, Abbottabad, Kohat', id_label: '14-digit Reference Number' },
  { name: 'HESCO',  category: 'electricity', region: 'Hyderabad, Mirpurkhas, Nawabshah, Badin, Thatta', id_label: '14-digit Reference Number' },
  { name: 'SEPCO',  category: 'electricity', region: 'Sukkur and surrounding districts', id_label: '14-digit Reference Number' },
  { name: 'QESCO',  category: 'electricity', region: 'Quetta and Balochistan', id_label: '14-digit Reference Number' },
  { name: 'TESCO',  category: 'electricity', region: 'Tribal areas', id_label: '14-digit Reference Number' },
  { name: 'HAZECO', category: 'electricity', region: 'Hazara region', id_label: '14-digit Reference Number' },
  { name: 'K-Electric', category: 'electricity', region: 'Karachi', id_label: 'Consumer Number' },
  { name: 'AJK Electric', category: 'electricity', region: 'Azad Jammu & Kashmir', id_label: 'Reference Number' },

  // Gas
  { name: 'SNGPL', category: 'gas', region: 'Punjab, KPK', id_label: '10-11 digit Consumer Number' },
  { name: 'SSGC',  category: 'gas', region: 'Sindh, Balochistan', id_label: 'Consumer Number' },

  // Water (coverage varies by city — add more as found)
  { name: 'WASA Lahore',      category: 'water', region: 'Lahore', id_label: 'Consumer Number' },
  { name: 'WASA Faisalabad',  category: 'water', region: 'Faisalabad', id_label: 'Consumer Number' },
  { name: 'WASA Rawalpindi',  category: 'water', region: 'Rawalpindi', id_label: 'Consumer Number' },
];

const insert = db.prepare(`
  INSERT INTO providers (name, category, region, id_label, base_url, is_default)
  VALUES (@name, @category, @region, @id_label, @base_url, 1)
`);

const existing = db.prepare('SELECT name FROM providers WHERE is_default = 1').all().map(r => r.name);

let inserted = 0;
for (const p of defaultProviders) {
  if (existing.includes(p.name)) continue;
  insert.run({
    ...p,
    base_url: `https://bill.pitc.com.pk/fescobill/${p.name.toLowerCase().replace(/\s+/g, '-')}?ref={consumer_id}`,
  });
  inserted++;
}

console.log(`Seed complete: ${inserted} providers inserted, ${existing.length} already present.`);
