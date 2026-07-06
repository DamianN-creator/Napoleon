import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { Product, ProductCategory, RecipeItem } from '../types';
import { categoryLabels } from '../data/initialData';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  DollarSign,
  Boxes,
  FlaskConical,
  Image as ImageIcon,
  Globe,
  RefreshCw,
} from 'lucide-react';

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct, rawMaterials, subProducts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    halfPrice: '' as number | '',
    pedidosYaPrice: '' as number | '',
    category: 'pizzas' as ProductCategory,
    ingredients: '',
    available: true,
    isPizza: false,
    image: '' as string | undefined,
    description: '',
    publishedOnline: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Recipe state
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  // 'rawMaterial' | 'subProduct'
  const [recipeItemType, setRecipeItemType] = useState<'rawMaterial' | 'subProduct'>('rawMaterial');
  const [recipeMatId, setRecipeMatId] = useState('');
  const [recipeQty, setRecipeQty] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.ingredients.some(i => i.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const addRecipeItem = () => {
    const qty = Number(recipeQty);
    if (!recipeMatId || !qty || qty <= 0) return;

    if (recipeItemType === 'rawMaterial') {
      const mat = rawMaterials.find(m => m.id === recipeMatId);
      if (!mat || recipe.some(r => r.rawMaterialId === recipeMatId)) return;
      setRecipe(prev => [...prev, { rawMaterialId: mat.id, rawMaterialName: mat.name, quantity: qty, unit: mat.unit }]);
    } else {
      const sp = subProducts.find(s => s.id === recipeMatId);
      if (!sp || recipe.some(r => r.subProductId === recipeMatId)) return;
      setRecipe(prev => [...prev, { subProductId: sp.id, subProductName: sp.name, quantity: qty, unit: sp.unit }]);
    }
    setRecipeMatId('');
    setRecipeQty('');
  };

  const removeRecipeItem = (item: RecipeItem) => {
    setRecipe(prev => prev.filter(r =>
      item.rawMaterialId ? r.rawMaterialId !== item.rawMaterialId : r.subProductId !== item.subProductId
    ));
  };

  const handleAddProduct = () => {
    if (!formData.name.trim() || formData.price <= 0) return;

    const newProduct: Product = {
      id: `product-${Date.now()}`,
      name: formData.name,
      price: formData.price,
      halfPrice: formData.halfPrice !== '' ? Number(formData.halfPrice) : undefined,
      pedidosYaPrice: formData.pedidosYaPrice !== '' ? Number(formData.pedidosYaPrice) : undefined,
      category: formData.category,
      ingredients: formData.ingredients.split(',').map(i => i.trim()).filter(Boolean),
      available: formData.available,
      isPizza: formData.isPizza || formData.category === 'pizzas',
      recipe: recipe.length > 0 ? recipe : undefined,
      image: formData.image || undefined,
      description: formData.description.trim() || undefined,
      publishedOnline: formData.publishedOnline,
    };

    addProduct(newProduct);
    resetForm();
    setShowAddModal(false);
  };

  const handleEditProduct = () => {
    if (!editingProduct || !formData.name.trim() || formData.price <= 0) return;

    const updatedProduct: Product = {
      ...editingProduct,
      name: formData.name,
      price: formData.price,
      halfPrice: formData.halfPrice !== '' ? Number(formData.halfPrice) : undefined,
      pedidosYaPrice: formData.pedidosYaPrice !== '' ? Number(formData.pedidosYaPrice) : undefined,
      category: formData.category,
      ingredients: formData.ingredients.split(',').map(i => i.trim()).filter(Boolean),
      available: formData.available,
      isPizza: formData.isPizza || formData.category === 'pizzas',
      recipe: recipe.length > 0 ? recipe : undefined,
      image: formData.image || undefined,
      description: formData.description.trim() || undefined,
      publishedOnline: formData.publishedOnline,
    };

    updateProduct(updatedProduct);
    resetForm();
    setEditingProduct(null);
  };

  const handleDeleteProduct = (productId: string) => {
    if (confirm('Estas seguro de eliminar este producto?')) {
      deleteProduct(productId);
    }
  };

  const toggleAvailability = (product: Product) => {
    updateProduct({ ...product, available: !product.available });
  };

  const resetForm = () => {
    setFormData({
      name: '', price: 0, halfPrice: '', pedidosYaPrice: '', category: 'pizzas',
      ingredients: '', available: true, isPizza: false,
      image: '', description: '', publishedOnline: false,
    });
    setRecipe([]);
    setRecipeItemType('rawMaterial');
    setRecipeMatId('');
    setRecipeQty('');
    setImageUploadError(null);
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      halfPrice: product.halfPrice ?? '',
      pedidosYaPrice: product.pedidosYaPrice ?? '',
      category: product.category,
      ingredients: product.ingredients.join(', '),
      available: product.available,
      isPizza: product.isPizza,
      image: product.image ?? '',
      description: product.description ?? '',
      publishedOnline: product.publishedOnline ?? false,
    });
    setRecipe(product.recipe || []);
    setRecipeMatId('');
    setRecipeQty('');
    setImageUploadError(null);
  };

  const handleImageUpload = async (file: File) => {
    setImageUploadError(null);
    setUploadingImage(true);
    const path = `${editingProduct?.id || 'new-' + Date.now()}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) {
      setImageUploadError('No se pudo subir la imagen. Intenta de nuevo.');
      setUploadingImage(false);
      return;
    }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    setFormData(prev => ({ ...prev, image: data.publicUrl }));
    setUploadingImage(false);
  };

  const categoryStats = useMemo(() => {
    const stats: Record<string, { total: number; available: number }> = {};
    products.forEach(p => {
      if (!stats[p.category]) {
        stats[p.category] = { total: 0, available: 0 };
      }
      stats[p.category].total++;
      if (p.available) stats[p.category].available++;
    });
    return stats;
  }, [products]);

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-teal-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Productos</h1>
              <p className="text-gray-400 text-sm">{products.length} productos en catalogo</p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Producto
          </button>
        </div>

        {/* Category Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(categoryStats).map(([cat, stats]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as ProductCategory)}
              className={`p-3 rounded-xl border transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-500/20 border-teal-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-white font-medium text-sm">{categoryLabels[cat]}</p>
              <p className="text-gray-400 text-xs">{stats.available}/{stats.total} disponibles</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-lg border border-gray-700 focus:border-teal-500 focus:outline-none"
            placeholder="Buscar por nombre o ingrediente..."
          />
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className={`bg-gray-800 rounded-xl border ${
                product.available ? 'border-gray-700' : 'border-red-700 border-dashed'
              } overflow-hidden`}
            >
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-lg">{product.name}</p>
                      {product.isPizza && (
                        <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded">Pizza</span>
                      )}
                      {product.publishedOnline && (
                        <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-0.5 rounded flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Online
                        </span>
                      )}
                    </div>
                    <p className="text-teal-400 font-bold text-xl">${product.price.toLocaleString()}</p>
                    {product.pedidosYaPrice != null && (
                      <p className="text-orange-400 text-sm font-medium flex items-center gap-1">
                        <span className="bg-orange-500/20 text-orange-400 text-xs px-1.5 py-0.5 rounded font-semibold">PY</span>
                        ${product.pedidosYaPrice.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleAvailability(product)}
                    className={`p-2 rounded-lg ${
                      product.available
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {product.available ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>

                {/* Category Badge */}
                <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
                  {categoryLabels[product.category]}
                </span>

                {/* Ingredients */}
                {product.ingredients.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {product.ingredients.slice(0, 4).map((ing, idx) => (
                      <span
                        key={idx}
                        className="bg-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded"
                      >
                        {ing}
                      </span>
                    ))}
                    {product.ingredients.length > 4 && (
                      <span className="text-gray-500 text-xs">
                        +{product.ingredients.length - 4} mas
                      </span>
                    )}
                  </div>
                )}

                {/* Recipe badge */}
                {product.recipe && product.recipe.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {product.recipe.filter(r => r.rawMaterialId).length > 0 && (
                      <span className="flex items-center gap-1 text-teal-400 text-xs">
                        <Boxes className="w-3 h-3" />
                        {product.recipe.filter(r => r.rawMaterialId).length} insumo{product.recipe.filter(r => r.rawMaterialId).length > 1 ? 's' : ''}
                      </span>
                    )}
                    {product.recipe.filter(r => r.subProductId).length > 0 && (
                      <span className="flex items-center gap-1 text-indigo-400 text-xs">
                        <FlaskConical className="w-3 h-3" />
                        {product.recipe.filter(r => r.subProductId).length} subproducto{product.recipe.filter(r => r.subProductId).length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Status */}
                {!product.available && (
                  <p className="text-red-400 text-sm mt-3 font-medium">No disponible</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-700">
                  <button
                    onClick={() => startEdit(product)}
                    className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="py-2 px-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-xl">No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingProduct) && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setEditingProduct(null);
            resetForm();
          }}
        >
          <div
            className="bg-gray-800 rounded-xl border border-gray-700 max-w-md w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-700 shrink-0">
              <h2 className="text-xl font-bold text-white">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 p-6 overflow-y-auto">
              <div>
                <label className="text-gray-400 text-sm">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none mt-1"
                  placeholder="Nombre del producto"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm">Precio entero *</label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Precio medio <span className="text-gray-600">(opcional)</span></label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="number"
                      value={formData.halfPrice}
                      onChange={e => setFormData({ ...formData, halfPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none"
                      placeholder="—"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm flex items-center gap-2">
                  <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded font-semibold">PY</span>
                  Precio PedidosYa <span className="text-gray-600">(opcional)</span>
                </label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-500/60" />
                  <input
                    type="number"
                    value={formData.pedidosYaPrice}
                    onChange={e => setFormData({ ...formData, pedidosYaPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full bg-gray-700 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-600 focus:border-orange-500 focus:outline-none"
                    placeholder="—"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm">Categoria</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({
                    ...formData,
                    category: e.target.value as ProductCategory,
                    isPizza: e.target.value === 'pizzas',
                  })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none mt-1"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm">Ingredientes (separados por coma)</label>
                <input
                  type="text"
                  value={formData.ingredients}
                  onChange={e => setFormData({ ...formData, ingredients: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none mt-1"
                  placeholder="salsa, muzzarella, oregano"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available}
                    onChange={e => setFormData({ ...formData, available: e.target.checked })}
                    className="w-5 h-5 rounded text-teal-500"
                  />
                  <span className="text-white">Disponible</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPizza}
                    onChange={e => setFormData({ ...formData, isPizza: e.target.checked })}
                    className="w-5 h-5 rounded text-teal-500"
                  />
                  <span className="text-white">Es Pizza (permite mitad y mitad)</span>
                </label>
              </div>

              {/* Online store fields */}
              <div className="border-t border-gray-700 pt-4 space-y-4">
                <label className="text-gray-400 text-sm flex items-center gap-1">
                  <Globe className="w-4 h-4" />
                  Tienda Online
                </label>

                <div>
                  <label className="text-gray-400 text-sm">Foto</label>
                  <div className="flex items-center gap-3 mt-1">
                    {formData.image ? (
                      <img src={formData.image} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-600" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-700 border border-gray-600 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                        className="text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white file:cursor-pointer hover:file:bg-teal-600"
                      />
                      {uploadingImage && (
                        <p className="text-teal-400 text-xs mt-1 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Subiendo...
                        </p>
                      )}
                      {imageUploadError && (
                        <p className="text-red-400 text-xs mt-1">{imageUploadError}</p>
                      )}
                      {formData.image && !uploadingImage && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, image: '' })}
                          className="text-gray-500 hover:text-red-400 text-xs mt-1"
                        >
                          Quitar foto
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-sm">Descripcion para la tienda online</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none mt-1"
                    placeholder="Descripcion breve para mostrarle al cliente"
                    rows={2}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.publishedOnline}
                    onChange={e => setFormData({ ...formData, publishedOnline: e.target.checked })}
                    className="w-5 h-5 rounded text-teal-500"
                  />
                  <span className="text-white">Publicar en Tienda Online</span>
                </label>
              </div>

              {/* Recipe */}
              {(rawMaterials.length > 0 || subProducts.length > 0) && (
                <div className="border-t border-gray-700 pt-4">
                  <label className="text-gray-400 text-sm flex items-center gap-1 mb-3">
                    <Boxes className="w-4 h-4" />
                    Receta por unidad vendida
                  </label>

                  {recipe.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {recipe.map((r, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            {r.subProductId
                              ? <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                              : <Boxes className="w-3.5 h-3.5 text-teal-400" />
                            }
                            <span className="text-white">{r.rawMaterialName || r.subProductName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`font-medium ${r.subProductId ? 'text-indigo-400' : 'text-teal-400'}`}>
                              {r.quantity} {r.unit}
                            </span>
                            <button onClick={() => removeRecipeItem(r)} className="text-gray-500 hover:text-red-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Toggle insumo / subproducto */}
                  <div className="flex gap-1 bg-gray-700/50 p-1 rounded-lg mb-2 w-fit">
                    <button
                      onClick={() => { setRecipeItemType('rawMaterial'); setRecipeMatId(''); }}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                        recipeItemType === 'rawMaterial' ? 'bg-teal-500 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Boxes className="w-3 h-3" /> Insumo
                    </button>
                    {subProducts.length > 0 && (
                      <button
                        onClick={() => { setRecipeItemType('subProduct'); setRecipeMatId(''); }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                          recipeItemType === 'subProduct' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <FlaskConical className="w-3 h-3" /> Subproducto
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={recipeMatId}
                      onChange={e => setRecipeMatId(e.target.value)}
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none text-sm"
                    >
                      {recipeItemType === 'rawMaterial' ? (
                        <>
                          <option value="">Seleccionar insumo...</option>
                          {rawMaterials
                            .filter(m => !recipe.some(r => r.rawMaterialId === m.id))
                            .map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                        </>
                      ) : (
                        <>
                          <option value="">Seleccionar subproducto...</option>
                          {subProducts
                            .filter(s => !recipe.some(r => r.subProductId === s.id))
                            .map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                        </>
                      )}
                    </select>
                    <input
                      type="number"
                      value={recipeQty}
                      onChange={e => setRecipeQty(e.target.value)}
                      className="w-24 bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-teal-500 focus:outline-none text-sm text-center"
                      placeholder="Cant."
                      min="0"
                      step="0.01"
                    />
                    <button
                      onClick={addRecipeItem}
                      disabled={!recipeMatId || !recipeQty || Number(recipeQty) <= 0}
                      className="bg-teal-500 hover:bg-teal-600 disabled:bg-gray-600 disabled:text-gray-400 text-white px-3 py-2 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 pt-4 border-t border-gray-700 shrink-0">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProduct(null);
                  resetForm();
                }}
                className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingProduct ? handleEditProduct : handleAddProduct}
                disabled={!formData.name.trim() || formData.price <= 0}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  formData.name.trim() && formData.price > 0
                    ? 'bg-teal-500 hover:bg-teal-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-5 h-5" />
                {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
