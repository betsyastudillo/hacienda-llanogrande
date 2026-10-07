export const isValidPhone = (value) => /^\d{7,15}$/.test(value)
export const isValidEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)