const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use('/auth', express.static(path.join(__dirname, '../auth')));
app.use('/app', express.static(path.join(__dirname, '../app')));

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/auth/Landing.html');
});

// ==================== AUTHENTICATION ENDPOINTS ====================

// POST: Sign up with email and password
app.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, businessName, phoneNumber } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please enter both email and password' 
      });
    }

    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          business_name: businessName,
          phone: phoneNumber
        }
      }
    });

    if (error) {
      return res.status(400).json({ 
        error: error.message 
      });
    }

    res.status(201).json({
      message: 'Account created successfully! Please check your email to verify.',
      user: data.user
    });

  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ 
      error: 'Server error during sign up' 
    });
  }
});

// POST: Sign in with email and password
app.post("/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Please enter both email and password' 
      });
    }

    // Sign in user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      return res.status(401).json({ 
        error: error.message || 'Login failed - check your credentials' 
      });
    }

    res.status(200).json({
      message: 'Welcome back! You are now signed in.',
      user: data.user,
      session: data.session
    });

  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ 
      error: 'Server error during sign in' 
    });
  }
});

// POST: Sign out
app.post("/auth/signout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      console.error('Sign out error:', error);
    }

    res.status(200).json({
      message: 'Successfully signed out'
    });

  } catch (error) {
    console.error('Sign out error:', error);
    res.status(500).json({ 
      error: 'Server error during sign out' 
    });
  }
});

// GET: Get current user
app.get("/auth/user", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.status(200).json({
      user: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Server error getting user' 
    });
  }
});

// PUT: Update user profile
app.put("/auth/update-profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fullName } = req.body;

    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: fullName }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({
      message: 'Profile updated successfully',
      user: data.user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'Server error updating profile' 
    });
  }
});

// ==================== MIDDLEWARE ====================

// Middleware to verify authentication
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// ==================== PRODUCT ENDPOINTS ====================

// CREATE: Add new product
app.post("/app/products", verifyAuth, async (req, res) => {
  try {
    const { name, price, quantity, category, minStock } = req.body;

    // Validate all required fields
    if (
      !name ||
      price === undefined ||
      quantity === undefined ||
      !category ||
      minStock === undefined
    ) {
      return res.status(400).json({
        error: "All fields required: name, price, quantity, category, minStock",
      });
    }

    // Get or create category
    let { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError) {
      // Category doesn't exist, create it
      const { data: newCategory, error: createError } = await supabase
        .from('categories')
        .insert([{ name: category }])
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: 'Failed to create category' });
      }
      categoryData = newCategory;
    }

    // Insert product
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert([{
        user_id: req.user.id,
        name: name.trim(),
        category_id: categoryData.id,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        min_stock: parseInt(minStock)
      }])
      .select(`
        *,
        categories (name)
      `)
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.status(201).json({
      message: "Product saved successfully",
      product: product,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Server error while creating product" });
  }
});

// READ: Get all products
app.get("/app/products", verifyAuth, async (req, res) => {
  try {
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        categories (name)
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }

    res.status(200).json({
      message: 'Products retrieved successfully',
      count: products.length,
      products: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// READ: Get single product by ID
app.get("/app/products/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        categories (name)
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product retrieved successfully',
      product: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE: Edit product by ID
app.put("/app/products/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, quantity, category, minStock } = req.body;

    // Get or create category
    let { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError) {
      // Category doesn't exist, create it
      const { data: newCategory, error: createError } = await supabase
        .from('categories')
        .insert([{ name: category }])
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: 'Failed to create category' });
      }
      categoryData = newCategory;
    }

    // Update product
    const { data: product, error: updateError } = await supabase
      .from('products')
      .update({
        name: name.trim(),
        category_id: categoryData.id,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        min_stock: parseInt(minStock)
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select(`
        *,
        categories (name)
      `)
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      product: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE: Remove product by ID
app.delete("/app/products/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      product: product
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ANALYTICS ENDPOINTS ====================

// GET: Analytics summary
app.get("/app/analytics/summary", verifyAuth, async (req, res) => {
  try {
    // Get low stock products
    const { data: lowStock, error: lowStockError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', req.user.id)
      .filter('quantity', 'lte', 'min_stock');

    // For now, return mock data for sales and top products
    // You can implement actual sales tracking later
    const response = {
      lowStock: lowStock || [],
      dailySales: [],
      topProducts: []
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Server is healthy',
    timestamp: new Date(),
    database: 'Connected to Supabase'
  });
});

// 404 - Not Found handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Connected to Supabase database`);
  console.log(`✓ API endpoints ready`);
  console.log(`✓ Authentication endpoints available`);
  console.log(`✓ Frontend available at http://localhost:${PORT}/auth/Landing.html`);
});