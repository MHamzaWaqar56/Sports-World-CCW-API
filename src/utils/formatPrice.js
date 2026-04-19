const formatPrice = (price) => {
    if (!price && price !== 0) return 'Rs. 0.00';
  
    const formatted = Number(price).toFixed(2); // e.g., 150 → "150.00"
    return `Rs. ${formatted}`; // OR use "PKR" instead of "Rs."
  };
  
  module.exports = formatPrice;
  