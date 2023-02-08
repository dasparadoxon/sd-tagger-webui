import os
from scripts.helpers.tagger import Tagger

# Helper functions #


def try_function(func, params: list = None):
    try:
        func(*params)
        return True
    except:
        return False


def try_function_get_except(func, params: list = None):
    try:
        func(*params)
        return None
    except Exception as e:
        return e


def try_function_get_output(func, params: list = None):
    try:
        return func(*params)
    except:
        return "try-function-except"


# Test functions #


def assert_equals(a, b, reason: str):
    assert a == b, "ASSERT_EQUALS FAILED [\"" + reason + "\"] ASSERTION " + str(a) + "==" + str(b)


def assert_except(func, reason: str):
    assert_except_params(func, [], reason)


def assert_except_params(func, params: list, reason: str):
    if try_function(func, params):
        raise AssertionError("ASSERT_EXCEPTION FAILED [\"" + reason + "\"]")


def assert_run(func, reason: str):
    assert_run_params(func, [], reason)


def assert_run_params(func, params: list, reason: str):
    ex = try_function_get_except(func, params)
    if ex is not None:
        print(ex)
        raise AssertionError("ASSERT_RUN FAILED [\"" + reason + "\"]")


def assert_file(path: str, reason: str):
    if not os.path.isfile(path):
        raise AssertionError("ASSERT_FILE FAILED [\"" + reason + "\"]")


# Begin Tests #


def test_tagger():
    # No path
    assert_except(lambda a: Tagger(""), "Tagger should except if path is invalid")

    # Empty dataset
    tagger = Tagger("./resources/testing/empty-dataset")
    assert_equals(tagger.num_files, 0, "Dataset should have been empty")
    assert_except(tagger.current, "Tagger.current() should always except if the dataset is empty")
    assert_run(tagger.next, "Tagger.next() should run on an empty dataset")
    assert_run(tagger.previous, "Tagger.previous() should run on an empty dataset")
    assert_except_params(tagger.get_image, [0], "Tagger.get_image() should except on an empty dataset")

    # Load testing dataset
    tagger = Tagger("./resources/testing/dataset")

    # Verify that there are only 3 images
    assert_equals(tagger.num_files, 3, "Tagger should have three images")

    # Testing previous() current() next()
    tagger.previous()
    assert_equals(tagger.index, tagger.num_files - 1, "Tagger index should be the last index")

    img_data = tagger.current()
    assert_equals(img_data.tags[0], "blue", "Last item should be the [green, square]")

    tagger.next()
    assert_equals(tagger.index, 0, "Tagger index should be 0")

    # Testing get_image()
    img_data = try_function_get_output(tagger.get_image, [0])
    assert_except_params(tagger.get_image, [-1], "Tagger.get_image() should except on lower out of bounds")
    assert_except_params(tagger.get_image, [3], "Tagger.get_image() should except on upper out of bounds")
    assert_equals(img_data.tags[0], "red", "First item should be the [red, square]")

    # Load no txt dataset
    tagger = Tagger("./resources/testing/dataset-no-txt")

    # Get tags for first image
    img_data = try_function_get_output(tagger.get_image, [0])

    # Verify that tags for this image are empty
    assert_equals(img_data.tags, [], "Tags should be empty")

    # Write the tags and then save
    img_data.tags = ["red, square"]
    img_data.save()
    assert_file(img_data.tagfile, "When save is called it should create a txt file")
    os.remove(img_data.tagfile)


# Run Tests #


def run_tests():
    test_tagger()


# Entry Point #


run_tests()
print("Tests Done.")
