import React, { useState, useRef, useEffect, useMemo } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  subLabel?: string;
  price?: number;
  code?: string;
  category?: string;
  unit?: string;
  raw?: any;
};

export interface ComboboxProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string, selectedOption?: ComboboxOption) => void;
  options: ComboboxOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
  allowCustom?: boolean;
  showClear?: boolean;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export function Combobox({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = "Search or select...",
  required = false,
  disabled = false,
  className = "",
  size = "md",
  allowCustom = true,
  showClear = true,
  onBlur,
  autoFocus = false,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync display text with value or matching option
  useEffect(() => {
    const match = options.find(
      (opt) => opt.value === value || opt.label === value || (opt.code && opt.code === value)
    );
    if (match) {
      setQuery(match.label);
    } else {
      setQuery(value || "");
    }
  }, [value, options]);

  // Filtered options based on query
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
        (opt.code && opt.code.toLowerCase().includes(q)) ||
        (opt.category && opt.category.toLowerCase().includes(q)) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
        if (onBlur) onBlur();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onBlur]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLDivElement>(".combobox-dropdown-item");
      if (items[activeIndex]) {
        items[activeIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

  function handleSelect(opt: ComboboxOption) {
    setQuery(opt.label);
    onChange(opt.value, opt);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setActiveIndex(0);
    if (allowCustom) {
      onChange(val);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(filtered.length - 1);
      } else {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && filtered[activeIndex]) {
        e.preventDefault();
        handleSelect(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Tab") {
      if (isOpen && activeIndex >= 0 && filtered[activeIndex]) {
        handleSelect(filtered[activeIndex]);
      }
      setIsOpen(false);
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    onChange("");
    setIsOpen(false);
    inputRef.current?.focus();
  }

  const sizeClass = size === "sm" ? "form-control-sm" : size === "lg" ? "form-control-lg" : "";
  const btnSizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  return (
    <div ref={containerRef} className={`position-relative combobox-container ${className}`}>
      <div className="input-group">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          className={`form-control bg-dark text-white border-secondary ${sizeClass}`}
          style={{ minHeight: size === "sm" ? "32px" : "38px" }}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          required={required}
          disabled={disabled}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        {showClear && query && !disabled && (
          <button
            type="button"
            className={`btn btn-outline-secondary ${btnSizeClass}`}
            onClick={handleClear}
            tabIndex={-1}
            title="Clear"
            style={{ borderLeft: "none", borderRight: "none" }}
          >
            <i className="bi bi-x" />
          </button>
        )}
        <button
          type="button"
          className={`btn btn-outline-secondary ${btnSizeClass}`}
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) inputRef.current?.focus();
          }}
          disabled={disabled}
          tabIndex={-1}
          title="Toggle dropdown"
        >
          <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`} />
        </button>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="combobox-dropdown position-absolute w-100 shadow-lg"
          style={{
            top: "100%",
            left: 0,
            zIndex: 1060,
            maxHeight: "260px",
            overflowY: "auto",
            background: "#1e293b",
            border: "1px solid #475569",
            borderRadius: "8px",
            marginTop: "2px",
          }}
        >
          {filtered.length === 0 ? (
            <div className="p-2 text-white-50 small text-center">
              No matching results {query ? `for "${query}"` : ""}
            </div>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = opt.value === value || opt.label === value;
              const isHighlighted = idx === activeIndex;

              return (
                <div
                  key={`${opt.value}-${idx}`}
                  className={`combobox-dropdown-item px-3 py-2 cursor-pointer border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center ${
                    isHighlighted ? "bg-warning text-dark fw-bold" : isSelected ? "bg-dark text-warning fw-bold" : "text-light"
                  }`}
                  style={{
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input onBlur before select
                    handleSelect(opt);
                  }}
                >
                  <div className="d-flex flex-column">
                    <span className="text-truncate">
                      {opt.label}
                      {opt.code && opt.code !== opt.label && (
                        <span className={`badge ms-2 ${isHighlighted ? "bg-dark text-warning" : "bg-secondary text-light"}`} style={{ fontSize: "0.75rem" }}>
                          {opt.code}
                        </span>
                      )}
                    </span>
                    {opt.subLabel && (
                      <small className={isHighlighted ? "text-dark opacity-75" : "text-white-50"}>
                        {opt.subLabel}
                      </small>
                    )}
                  </div>
                  {opt.price !== undefined && (
                    <span className={`badge ms-2 ${isHighlighted ? "bg-dark text-warning" : "bg-warning text-dark"}`}>
                      Rs. {opt.price}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
