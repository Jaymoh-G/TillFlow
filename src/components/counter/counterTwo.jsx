import React, { useState } from "react";
import { MinusCircle, PlusCircle } from "react-feather";

const CounterTwo = ({ defaultValue = 0 }) => {
  const [quantity, setQuantity] = useState(defaultValue);

  const handleIncrement = () => {
    if (quantity < 99) setQuantity(quantity + 1);
  };

  const handleDecrement = () => {
    if (quantity > 0) setQuantity(quantity - 1);
  };

  const handleChange = (e) => {
    const value = e.target.value;
    const numericValue = parseInt(value, 10);

    if (value === "") {
      setQuantity(0);
    } else if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 99) {
      setQuantity(numericValue);
    }
  };

  return (
    <>
      <span className="quantity-btn" onClick={handleDecrement}>
        <MinusCircle size={16} />
      </span>

      <input
        type="text"
        className="quntity-input p-0"
        value={quantity.toString()}
        onChange={handleChange}
      />

      <span className="quantity-btn" onClick={handleIncrement}>
        <PlusCircle size={16} />
      </span>
    </>
  );
};

export default CounterTwo;
