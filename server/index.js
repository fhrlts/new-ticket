const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup (using SQLite as PostgreSQL alternative for WebContainer)
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tickets table
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (assigned_to) REFERENCES users (id)
    )
  `);

  // Create default admin user
  const adminEmail = 'admin@example.com';
  const adminPassword = bcrypt.hashSync('admin123', 10);
  
  db.run(`
    INSERT OR IGNORE INTO users (email, password, full_name, role)
    VALUES (?, ?, ?, ?)
  `, [adminEmail, adminPassword, 'System Administrator', 'admin']);
});

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Routes

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (email, password, full_name) VALUES (?, ?, ?)',
      [email, hashedPassword, fullName || ''],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        
        const token = jwt.sign(
          { id: this.lastID, email, role: 'user' },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        res.json({
          token,
          user: { id: this.lastID, email, fullName: fullName || '', role: 'user' }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get(
      'SELECT * FROM users WHERE email = ?',
      [email],
      async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed' });
        }
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role: user.role
          }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Ticket routes
app.get('/api/tickets', authenticateToken, (req, res) => {
  let query = `
    SELECT t.*, u.full_name as user_name, u.email as user_email,
           a.full_name as assigned_name
    FROM tickets t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN users a ON t.assigned_to = a.id
  `;
  
  const params = [];
  
  if (req.user.role !== 'admin') {
    query += ' WHERE t.user_id = ?';
    params.push(req.user.id);
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  db.all(query, params, (err, tickets) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch tickets' });
    }
    res.json(tickets);
  });
});

app.post('/api/tickets', authenticateToken, (req, res) => {
  const { title, description, priority = 'medium' } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  
  db.run(
    'INSERT INTO tickets (title, description, priority, user_id) VALUES (?, ?, ?, ?)',
    [title, description, priority, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to create ticket' });
      }
      
      db.get(
        `SELECT t.*, u.full_name as user_name, u.email as user_email
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [this.lastID],
        (err, ticket) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch created ticket' });
          }
          res.status(201).json(ticket);
        }
      );
    }
  );
});

app.put('/api/tickets/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { status, assigned_to, priority } = req.body;
  
  // Check if user can update this ticket
  db.get('SELECT * FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch ticket' });
    }
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Only admin or ticket owner can update
    if (req.user.role !== 'admin' && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this ticket' });
    }
    
    // Only admin can assign tickets and change status to resolved/closed
    if (req.user.role !== 'admin' && (assigned_to !== undefined || 
        (status && ['resolved', 'closed'].includes(status)))) {
      return res.status(403).json({ error: 'Admin access required for this action' });
    }
    
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    db.run(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`,
      params,
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update ticket' });
        }
        
        db.get(
          `SELECT t.*, u.full_name as user_name, u.email as user_email,
                  a.full_name as assigned_name
           FROM tickets t
           JOIN users u ON t.user_id = u.id
           LEFT JOIN users a ON t.assigned_to = a.id
           WHERE t.id = ?`,
          [id],
          (err, updatedTicket) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to fetch updated ticket' });
            }
            res.json(updatedTicket);
          }
        );
      }
    );
  });
});

// Admin routes
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all(
    'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC',
    [],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      res.json(users);
    }
  );
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const stats = {};
  
  // Get ticket counts by status
  db.all(
    'SELECT status, COUNT(*) as count FROM tickets GROUP BY status',
    [],
    (err, statusCounts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch stats' });
      }
      
      stats.ticketsByStatus = statusCounts.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {});
      
      // Get total users
      db.get('SELECT COUNT(*) as count FROM users', [], (err, userCount) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch stats' });
        }
        
        stats.totalUsers = userCount.count;
        
        // Get total tickets
        db.get('SELECT COUNT(*) as count FROM tickets', [], (err, ticketCount) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to fetch stats' });
          }
          
          stats.totalTickets = ticketCount.count;
          res.json(stats);
        });
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Default admin login: admin@example.com / admin123`);
});