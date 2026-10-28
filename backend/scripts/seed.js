import bcrypt from 'bcryptjs';
import { pool, withTx } from '../src/db.js';
import { config } from '../src/config.js';

if (!config.demoUserPassword) {
  process.stderr.write('Set DEMO_USER_PASSWORD (min 12 chars) in backend/.env to seed demo accounts.\n');
  process.exit(1);
}

const categories = [
  'Romance', 'Mystery', 'Science Fiction', 'Fantasy', 'Historical', 'Biography', 'Self-help', 'Memoir', 'Travel',
  'Cooking', "Children's", 'Young Adult', 'Comics & Graphic Novels', 'Poetry', 'Drama', 'Science', 'Philosophy',
  'Religion', 'Language Learning',
];
const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const brands = ['Non-fiction Press', 'Self Help House', 'Fiction Works', 'Thriller Tales', 'Horror House', 'Little Readers', 'ABC Publishers', 'Orbit Books', 'Quill & Ink'];

const authors = [
  ['Arjun Patel', 'Writes practical guides on focus and productivity.'],
  ['Raj Patel', 'Educator and author on lifelong learning.'],
  ['James Wright', 'Business coach and author of success handbooks.'],
  ['James Adams', 'Suspense novelist known for atmospheric thrillers.'],
  ['Jessica Martin', 'Romance and drama author.'],
  ['Laura Mitchell', 'Science-fiction writer exploring space and society.'],
  ['Daniel Reed', 'Writer, minimalist, and speaker based in San Francisco. Author of The Joy of Minimalism, Less But Better and The Focus Street.'],
  ['Clara Nelson', 'Writes chilling mystery and horror stories.'],
  ['Emilly Parker', 'Children\'s author with a love for animals.'],
  ['Meera Iyer', 'Historian and travel writer.'],
  ['Tomas Berg', 'Fantasy author of the Ember Crown saga.'],
  ['Anita Rao', 'Chef and cookbook author.'],
];

// [title, author, brand, category, kind, tagline, description, format, language, price INR, stock, deliveryDays, sold, [bg, fg, accent], daysAgo]
const books = [
  ['The Art of Focus', 'Arjun Patel', 'Non-fiction Press', 'Self-help', 'Non-Fiction', 'A practical guide to mastering focus & boosting productivity every day.', 'Learn simple, repeatable habits to protect your attention and finish meaningful work.', 'Paperback', 'English', 399, 40, 3, 820, ['#f3efe6', '#1b1b1b', '#d62828'], 400],
  ['The Art of Learning', 'Raj Patel', 'Non-fiction Press', 'Self-help', 'Non-Fiction', 'Master the mindset and methods for effective lifelong learning.', 'A framework for learning faster, retaining more and staying curious for life.', 'Paperback', 'English', 259, 55, 3, 640, ['#d9352b', '#ffffff', '#f5b942'], 380],
  ['The Path to Success', 'James Wright', 'Self Help House', 'Self-help', 'Non-Fiction', 'A practical guide to achieving goals with clarity and confidence.', 'Set goals, build momentum and navigate setbacks with a proven roadmap.', 'Paperback', 'English', 359, 35, 3, 710, ['#14919b', '#ffffff', '#f5b942'], 360],
  ['The Midnight Hour', 'James Adams', 'Fiction Works', 'Mystery', 'Fiction', 'Haunting tale of a man\'s journey & the shadows of a forgotten past.', 'A detective returns to his hometown where every clock stopped at midnight.', 'Paperback', 'English', 299, 25, 4, 905, ['#0f1f3a', '#e8eefc', '#4aa3ff'], 200],
  ['Beneath the Stars', 'Jessica Martin', 'Fiction Works', 'Romance', 'Fiction', 'A heartwarming tale where two souls discover who you need.', 'Two strangers meet during a meteor shower and a summer changes everything.', 'Hardcover', 'English', 499, 18, 5, 780, ['#3b2a5c', '#ffffff', '#f4a7c1'], 190],
  ['The Final Frontier', 'Laura Mitchell', 'Thriller Tales', 'Science Fiction', 'Fiction', 'A mission to space seekers to change humanity forever.', 'A crew races to the edge of known space with humanity\'s future on board.', 'Paperback', 'English', 359, 30, 4, 860, ['#10253f', '#ffffff', '#ff7a30'], 170],
  ['Joy of Minimalism', 'Daniel Reed', 'ABC Publishers', 'Self-help', 'Non-Fiction', 'Declutter your life to uncover peace, clarity, and joy.', 'Discover how less can truly be more. In The Joy of Minimalism, Daniel Reed guides you through practical strategies to declutter your space and schedule. Whether you\'re overwhelmed, or just want to thrive, this book offers a simple, fulfilling life.', 'Paperback', 'English', 149, 120, 3, 140, ['#f9d423', '#1b1b1b', '#1b1b1b'], 12],
  ['The Vanishing House', 'Clara Nelson', 'Horror House', 'Mystery', 'Fiction', 'A chilling mystery unfolds when a house that disappears.', 'The Hargrove house vanishes overnight; one reporter follows the trail.', 'eBook', 'English', 99, 999, 0, 95, ['#13251f', '#d7f0e4', '#6fcf97'], 10],
  ['The Lost Kitten', 'Emilly Parker', 'Little Readers', "Children's", 'Fiction', 'A heartwarming story of courage, friendship, and new adventure.', 'A tiny kitten gets lost in the city and finds a family of friends along the way.', 'Hardcover', 'English', 339, 45, 3, 120, ['#f28c28', '#ffffff', '#fff3d6'], 8],
  ['Ember Crown', 'Tomas Berg', 'Orbit Books', 'Fantasy', 'Fiction', 'A young smith inherits a crown that burns.', 'Book one of the Ember Crown saga: a kingdom, a curse and a very hot crown.', 'Paperback', 'English', 449, 22, 4, 430, ['#2b0f0f', '#ffd9a8', '#e63946'], 150],
  ['Silk Roads & Salt', 'Meera Iyer', 'Quill & Ink', 'Historical', 'Non-Fiction', 'Trade, travel and empires along the oldest routes on earth.', 'A narrative history of the caravans that connected continents.', 'Hardcover', 'English', 599, 15, 6, 210, ['#6b4226', '#ffffff', '#f2c879'], 220],
  ['Spice Table', 'Anita Rao', 'Quill & Ink', 'Cooking', 'Non-Fiction', '80 weeknight recipes with big flavour.', 'Quick, pantry-friendly Indian dishes with step-by-step photos.', 'Paperback', 'English', 549, 28, 3, 390, ['#b5341b', '#fff7e6', '#f6bd16'], 140],
  ['Letters from Kyoto', 'Meera Iyer', 'Quill & Ink', 'Travel', 'Non-Fiction', 'A slow journey through temples, tea and seasons.', 'Essays from a year spent in the old capital of Japan.', 'eBook', 'English', 199, 999, 0, 175, ['#1d3c34', '#ffffff', '#f4b6c2'], 90],
  ['Quiet Mind', 'Raj Patel', 'Self Help House', 'Philosophy', 'Non-Fiction', 'Stoic habits for a noisy world.', 'Ancient ideas, modern routines: a short guide to calm.', 'Paperback', 'English', 279, 60, 3, 305, ['#2f3e46', '#ffffff', '#84a98c'], 75],
  ['Orbit Zero', 'Laura Mitchell', 'Orbit Books', 'Science Fiction', 'Fiction', 'The last station before silence.', 'A station engineer discovers a signal that should not exist.', 'Hardcover', 'English', 529, 12, 5, 260, ['#050a24', '#c8d6ff', '#7b61ff'], 30],
  ['Heart of the Harbour', 'Jessica Martin', 'Fiction Works', 'Romance', 'Fiction', 'A lighthouse keeper and a stranger at sea.', 'A slow-burn romance on a windswept coast.', 'Paperback', 'English', 329, 33, 4, 185, ['#1b4965', '#ffffff', '#fde2e4'], 45],
  ['Atoms and Everything', 'Raj Patel', 'Orbit Books', 'Science', 'Non-Fiction', 'A friendly tour of matter, energy and curiosity.', 'Physics explained for everyone with no equations required.', 'Paperback', 'English', 379, 38, 3, 225, ['#0b3954', '#ffffff', '#bfd7ea'], 60],
  ['Wild Verse', 'Clara Nelson', 'Quill & Ink', 'Poetry', 'Fiction', 'Poems from the edge of the forest.', 'A collection on nature, grief and renewal.', 'Paperback', 'English', 249, 50, 3, 90, ['#283618', '#fefae0', '#dda15e'], 25],
  ['Hindi Made Simple', 'Anita Rao', 'Quill & Ink', 'Language Learning', 'Non-Fiction', 'Everyday Hindi in 30 days.', 'Short lessons, audio-free pronunciation guides and daily practice.', 'Paperback', 'Hindi', 299, 70, 3, 150, ['#e07a1f', '#ffffff', '#2d6a4f'], 100],
];

const demoUsers = [
  ['Admin', 'admin@bookworm.test', 'admin', 0, 0],
  ['Asha Rao', 'asha@bookworm.test', 'customer', 250, 100000],
];

await withTx(async (db) => {
  await db.query(
    `INSERT INTO stores (id, name, tax_percent, delivery_charge_paise, free_delivery_above_paise, cancel_window_hours, point_value_paise, earn_paise_per_point)
     VALUES (1, 'Book Worm', 12.00, 4000, 49900, 48, 100, 1000)
     ON CONFLICT (id) DO NOTHING`,
  );
  for (const [i, name] of categories.entries()) {
    await db.query('INSERT INTO categories (name, slug, sort_order) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING', [name, slug(name), i]);
  }
  for (const name of brands) await db.query('INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  for (const [name, bio] of authors) {
    await db.query('INSERT INTO authors (name, bio) VALUES ($1,$2) ON CONFLICT (name) DO NOTHING', [name, bio]);
  }
  for (const b of books) {
    const [title, author, brand, category, kind, tagline, description, format, language, price, stock, days, sold, [bg, fg, accent], daysAgo] = b;
    await db.query(
      `INSERT INTO books (title, author_id, brand_id, category_id, kind, tagline, description, format, language,
                          price_paise, stock, delivery_days, copies_sold, cover_bg, cover_fg, cover_accent, published_on)
       VALUES ($1,
               (SELECT id FROM authors WHERE name = $2), (SELECT id FROM brands WHERE name = $3),
               (SELECT id FROM categories WHERE name = $4),
               $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, current_date - $17::int)
       ON CONFLICT (title, author_id, format) DO NOTHING`,
      [title, author, brand, category, kind, tagline, description, format, language, price * 100, stock, days, sold, bg, fg, accent, daysAgo],
    );
  }
  await db.query(
    `INSERT INTO coupons (code, percent_off, max_off_paise, min_order_paise) VALUES ('WELCOME10', 10, 20000, 20000)
     ON CONFLICT (code) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO coupons (code, flat_off_paise, min_order_paise) VALUES ('FLAT100', 10000, 30000)
     ON CONFLICT (code) DO NOTHING`,
  );

  const hash = await bcrypt.hash(config.demoUserPassword, 12);
  for (const [name, email, role, points, wallet] of demoUsers) {
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, gift_points, wallet_paise) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [name, email, hash, role, points, wallet],
    );
  }

  // Order history for the demo customer so "Buy it again" and recommendations have data.
  const asha = (await db.query(`SELECT id FROM users WHERE lower(email) = 'asha@bookworm.test'`)).rows[0];
  const hasOrders = (await db.query('SELECT 1 FROM orders WHERE user_id = $1 LIMIT 1', [asha.id])).rowCount > 0;
  if (!hasOrders) {
    const pick = async (title) => (await db.query('SELECT id, price_paise FROM books WHERE title = $1 LIMIT 1', [title])).rows[0];
    const lines = [await pick('The Art of Focus'), await pick('Beneath the Stars')];
    const subtotal = lines.reduce((s, l) => s + l.price_paise, 0);
    const tax = Math.round(subtotal * 0.12);
    const address = {
      firstName: 'Asha', lastName: 'Rao', line1: '12 MG Road', city: 'Bengaluru', pin: '560001',
      state: 'Karnataka', country: 'India', email: 'asha@bookworm.test', phone: '+91 9876543210',
    };
    const ord = await db.query(
      `INSERT INTO orders (user_id, status, subtotal_paise, tax_paise, delivery_paise, total_paise, points_earned,
                           ship_address, payment_method, estimated_delivery, created_at, paid_at, cancellable_until)
       VALUES ($1,'CONFIRMED',$2,$3,0,$4,$5,$6,'credit_card', current_date - 55, now() - interval '60 days', now() - interval '60 days', now() - interval '58 days')
       RETURNING id`,
      [asha.id, subtotal, tax, subtotal + tax, Math.floor((subtotal + tax) / 1000), JSON.stringify(address)],
    );
    for (const l of lines) {
      await db.query('INSERT INTO order_items (order_id, book_id, quantity, unit_price_paise) VALUES ($1,$2,1,$3)', [ord.rows[0].id, l.id, l.price_paise]);
    }
    await db.query(
      `INSERT INTO payments (order_id, method, amount_paise, status, reference, card_last4) VALUES ($1,'credit_card',$2,'SUCCESS','SIM-SEED',$3)`,
      [ord.rows[0].id, subtotal + tax, '4242'],
    );
    await db.query(
      `INSERT INTO reviews (book_id, user_id, rating, body) SELECT id, $1::int, 5, 'Practical and easy to apply.' FROM books WHERE title = 'The Art of Focus' ON CONFLICT DO NOTHING`,
      [asha.id],
    );
    await db.query(
      `INSERT INTO reviews (book_id, user_id, rating, body) SELECT id, $1::int, 4, 'Clear ideas, a calming read.' FROM books WHERE title = 'Joy of Minimalism' ON CONFLICT DO NOTHING`,
      [asha.id],
    );
  }
});

process.stdout.write(JSON.stringify({ level: 'info', msg: 'Seed complete', demoUsers: demoUsers.map((u) => u[1]) }) + '\n');
await pool.end();
