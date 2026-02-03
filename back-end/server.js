const express = require("express");
const cors = require("cors");
const { createAccount, createClient } = require('@supabase/supabase-js')
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

//initializing supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY

)

// Middleware
app.use(cors());
app.use(express.json());

// CREATE: Add new product
app.post("/Inventory-Management/products", async (req, res) => {
  try {
    const { name, price, quantity, category, minStock } = req.body;

    // Validate all required fields
    if (
      !name ||
      !price ||
      !quantity === undefined ||
      !category ||
      minStock === undefined
    ) {
      return res.status(400).json({
        error: "All fields required: name, price, quantity, category, minStock",
      });
    }

    
    // Get current user (from JWT token)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get category ID
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Insert product
    const { data: product, error: insertError } = await supabase
      .from('products')
      .insert([{
        user_id: user.id,
        name: name.trim(),
        category_id: categoryData.id,
        price: parseFloat(price),
        quantity: parseInt(quantity),
        min_stock: parseInt(minStock)
      }])
      .select();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    res.status(201).json({
      message: "Product saved successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Server error while creating product" });
  }
});

// READ: Get all products
app.get("/Inventory-Management/products", async(req, res) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        categories (name)
      `)
      .eq('user_id', user.id)
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
app.get("/Inventory-Management/products/:id", async(req, res) => {
    try {
    const { id } = req.params;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
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
app.put("/Inventory-Management/products/:id", async(req, res) => {
    try {
    const { id } = req.params;
    const { name, price, quantity, category, minStock } = req.body;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get category ID
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

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
      .eq('user_id', user.id)
      .select();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      product: product[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE: Remove product by ID
app.delete("/Inventory-Management/products/:id", async(req, res) => {
 try {
    const { id } = req.params;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: product, error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select();

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      product: product[0]
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint (for testing)
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

//start server
app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Connected to Supabase database`);
  console.log(`✓ API endpoints ready`);
});

