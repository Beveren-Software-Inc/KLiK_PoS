import React from 'react';
import { useProducts } from '../providers/ProductProvider';

export default function ProductTest() {
  const { products, isLoading, error, refetchProducts } = useProducts();

  if (isLoading) {
    return <div>Loading products...</div>;
  }

  if (error) {
    return (
      <div>
        <div style={{ color: 'red' }}>Error: {error}</div>
        <button onClick={refetchProducts}>Try Again</button>
      </div>
    );
  }

  return (
    <div>
      <h2>Products Loaded Successfully!</h2>
      <p>Total products: {products.length}</p>
      <div>
        <h3>First 5 products:</h3>
        {products.slice(0, 5).map(product => (
          <div key={product.id} style={{ border: '1px solid #ccc', margin: '5px', padding: '10px' }}>
            <strong>{product.name}</strong> - Stock: {product.available} - Price: {product.price}
          </div>
        ))}
      </div>
      <button onClick={refetchProducts}>Refresh Products</button>
    </div>
  );
}
