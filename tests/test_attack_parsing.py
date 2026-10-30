"""The adversarial test writer accepts the shapes models actually return."""

from keel.attack import extract_tests
from keel.attack import test_names as node_names


def test_tests_inside_a_class_are_found():
    src = "class TestEdges:\n    def test_zero(self):\n        assert True\n\ndef test_top():\n    assert True\n"
    assert node_names(src) == ["TestEdges::test_zero", "test_top"]


def test_reply_cut_off_before_the_closing_fence_still_parses():
    reply = "Here are the tests:\n```python\ndef test_x():\n    assert 1\n"
    assert extract_tests(reply) == "def test_x():\n    assert 1\n"


def test_prose_without_code_is_rejected():
    assert extract_tests("I could not write tests for this.") is None
