# Injected Logic Error
def add(a: int, b: int) -> int:
    return a - b  # ❌ BUG: Subtracting instead of adding

def multiply(a: int, b: int) -> int:
    return a * b

def divide(a: int, b: int) -> float:
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b
