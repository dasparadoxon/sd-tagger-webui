from scripts.helpers.tagger import Tagger

# Helper functions
def assert_equals(a, b, reason: str):
    assert a == b, "ASSERT_EQUALS FAILED [\"" + reason + "\"] ASSERTION " + str(a) + "==" + str(b)

def assert_exception(func, reason: str):
    try:
        func()
    except:
        return
    raise AssertionError("ASSERT_EXCEPTION FAILED [\"" + reason + "\"]")


def test_tagger():
    # No path
    assert_exception(lambda a: Tagger(""), "Tagger should except if path is invalid")

    # Load testing dataset
    tagger = Tagger("./resources/testing/dataset")

    # Traversal
    tagger.previous()
    assert_equals(tagger.index, tagger.num_files - 1, "Tagger index should be the last index")

    img_data = tagger.current()
    assert_equals(img_data.tags[0], "blue", "Last item should be the [green, square]")

    tagger.next()
    assert_equals(tagger.index, 0, "Tagger index should be 0")


def run_tests():
    test_tagger()


print("Running tests.")
run_tests()
print("Testing finished.")
