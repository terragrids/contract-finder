export const isNumber = number => {
    if (isNaN(number) || typeof number !== 'number') return false
    else return true
}

export const isNumberOrUndef = number => {
    if (number === undefined) return true
    return isNumber(number)
}

export const isPositiveOrZeroNumber = number => {
    if (isNumber(number) && number >= 0) return true
    else return false
}

export const isValidTrackerType = type => {
    if (type === 'gas-meter' || type === 'electricity-meter') return true
    else return false
}
