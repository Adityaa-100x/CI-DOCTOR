def add(a, b):
    return a + b

def divide(a, b):
    # BUG: Missing division by zero check
    return a / b

def find_average(numbers):
    # BUG: Missing empty list check causing ZeroDivisionError
    return sum(numbers) / len(numbers)

