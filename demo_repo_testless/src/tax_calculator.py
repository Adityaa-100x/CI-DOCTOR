# Financial Tax Service (Zero Unit Tests)
def calculate_total(price: float, tax_rate: float) -> float:
    # ❌ BUG: Subtracting tax instead of adding
    return round(price - (price * tax_rate), 2)
