import React, { useState, useEffect, useRef } from 'react';

const CustomDropdown = ({ label, options, value, onChange, iconMap }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;
  const displayIcon = iconMap && iconMap[value];

  return (
    <div ref={dropdownRef} style={styles.dropdown}>
      <button onClick={() => setIsOpen(!isOpen)} style={styles.button}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {displayIcon && <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>{displayIcon}</span>}
          <span>{label}: <strong>{displayLabel}</strong></span>
        </div>
        <span style={{ ...styles.arrow, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {isOpen && (
        <div style={styles.menu}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                style={{
                  ...styles.item,
                  backgroundColor: isSelected ? 'var(--accent-bg)' : 'transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--text-color)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {iconMap && iconMap[option.value] && <span style={{ marginRight: '8px', fontSize: '14px', width: '20px' }}>{iconMap[option.value]}</span>}
                {option.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const styles = {
  dropdown: { position: 'relative', display: 'inline-block' },
  button: {
    padding: '6px 12px', borderRadius: 'var(--radius-pill)', fontSize: '11px',
    cursor: 'pointer', fontFamily: 'inherit', background: 'var(--input-bg)',
    border: '1px solid var(--input-border)', color: 'var(--text-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minWidth: '100px', textAlign: 'left',
  },
  arrow: { marginLeft: '12px', transition: 'transform 0.2s', fontSize: '10px', opacity: 0.6 },
  menu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, minWidth: '100%',
    background: 'var(--dropdown-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(40px)',
    borderRadius: '12px',
    maxHeight: '240px', overflowY: 'auto',
    boxShadow: 'var(--dropdown-shadow)',
  },
  item: {
    padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
    display: 'flex', alignItems: 'center',
  },
};

export default CustomDropdown;