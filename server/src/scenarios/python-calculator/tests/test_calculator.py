import pytest
from src.calculator import add, divide, find_average

def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0

def test_divide():
    assert divide(10, 2) == 5.0
    assert divide(0, 5) == 0.0

def test_find_average():
    assert find_average([1, 2, 3, 4, 5]) == 3.0

