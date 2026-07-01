import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  disabled?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  label,
  icon,
  value,
  onChange,
  options,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="custom-select-container" ref={containerRef}>
      <label className="custom-select-label">
        {icon}
        <span>{label}</span>
      </label>
      
      <div className={`custom-select-wrapper ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="custom-select-trigger"
          onClick={handleToggle}
          disabled={disabled}
        >
          <span className="trigger-value">{selectedOption ? selectedOption.label : 'Select option'}</span>
          <ChevronDown className={`select-chevron ${isOpen ? 'rotated' : ''}`} size={16} />
        </button>

        {isOpen && (
          <div className="custom-select-options">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
