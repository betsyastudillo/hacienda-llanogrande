export const isValidPhone = (value) => /^\d{7,15}$/.test(value)
export const isValidEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)

export const MIN_ADDRESS_LENGTH = 8
export const isValidAddress = (value) => (value || '').trim().length >= MIN_ADDRESS_LENGTH