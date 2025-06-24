"use client"

import { useState } from "react"
import { X, Check } from "lucide-react"
import { categories } from "../data/mockData"

interface FilterPanelProps {
  filterOptions: {
    priceRange: [number, number]
    availability: string
    discount: boolean
  }
  onFilterChange: (newFilters: Partial<FilterPanelProps["filterOptions"]>) => void
  onClose: () => void
}

export default function FilterPanel({ filterOptions, onFilterChange, onClose }: FilterPanelProps) {
  const [minPrice, setMinPrice] = useState(filterOptions.priceRange[0])
  const [maxPrice, setMaxPrice] = useState(filterOptions.priceRange[1])
  const [availability, setAvailability] = useState(filterOptions.availability)
  const [discount, setDiscount] = useState(filterOptions.discount)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const handleApplyFilters = () => {
    onFilterChange({
      priceRange: [minPrice, maxPrice],
      availability,
      discount,
    })
    onClose()
  }

  const handleResetFilters = () => {
    setMinPrice(0)
    setMaxPrice(100)
    setAvailability("all")
    setDiscount(false)
    setSelectedCategories([])
    onFilterChange({
      priceRange: [0, 100],
      availability: "all",
      discount: false,
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-5 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">Filter Options</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Price Range */}
        <div>
          <h4 className="font-medium mb-2">Price Range</h4>
          <div className="flex items-center space-x-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                min="0"
              />
            </div>
            <span className="text-gray-500">to</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg"
                min={minPrice}
              />
            </div>
          </div>
        </div>

        {/* Availability */}
        <div>
          <h4 className="font-medium mb-2">Availability</h4>
          <div className="flex space-x-3">
            <button
              onClick={() => setAvailability("all")}
              className={`px-3 py-2 rounded-lg border ${
                availability === "all"
                  ? "bg-beveren-50 border-beveren-300 text-beveren-600"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setAvailability("inStock")}
              className={`px-3 py-2 rounded-lg border ${
                availability === "inStock"
                  ? "bg-beveren-50 border-beveren-300 text-beveren-600"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              In Stock
            </button>
            <button
              onClick={() => setAvailability("outOfStock")}
              className={`px-3 py-2 rounded-lg border ${
                availability === "outOfStock"
                  ? "bg-beveren-50 border-beveren-300 text-beveren-600"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {/* Discount */}
        <div>
          <h4 className="font-medium mb-2">Discount</h4>
          <button
            onClick={() => setDiscount(!discount)}
            className={`px-3 py-2 rounded-lg border flex items-center ${
              discount ? "bg-beveren-50 border-beveren-300 text-beveren-600" : "border-gray-300 text-gray-700"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border mr-2 flex items-center justify-center ${
                discount ? "bg-beveren-600 border-beveren-600" : "border-gray-400"
              }`}
            >
              {discount && <Check size={14} className="text-white" />}
            </div>
            Show only discounted items
          </button>
        </div>

        {/* Categories (simplified) */}
        <div>
          <h4 className="font-medium mb-2">Categories</h4>
          <div className="flex flex-wrap gap-2">
            {categories.slice(1, 5).map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  if (selectedCategories.includes(category.id)) {
                    setSelectedCategories(selectedCategories.filter((id) => id !== category.id))
                  } else {
                    setSelectedCategories([...selectedCategories, category.id])
                  }
                }}
                className={`px-2 py-1 rounded-lg border text-sm ${
                  selectedCategories.includes(category.id)
                    ? "bg-beveren-50 border-beveren-300 text-beveren-600"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                {category.icon} {category.name}
              </button>
            ))}
            <button className="px-2 py-1 rounded-lg border text-sm border-gray-300 text-gray-700">+ More</button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={handleResetFilters}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Reset Filters
        </button>
        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 bg-beveren-600 text-white rounded-lg hover:bg-beveren-700"
        >
          Apply Filters
        </button>
      </div>
    </div>
  )
}
