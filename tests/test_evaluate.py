import unittest

from sortcode.data import load
from sortcode.evaluate import attach_costs, score
from sortcode.routing import COST


class Scoring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test = load("test")

    def test_perfect_predictions_cost_nothing(self):
        m = score(attach_costs(self.test, None, self.test["intent"]))
        self.assertEqual(m["intent_accuracy"], 1.0)
        self.assertEqual(m["queue_accuracy"], 1.0)
        self.assertEqual(m["security_recall"], 1.0)
        self.assertEqual(m["harm_per_1000"], 0.0)
        self.assertEqual(m["worst_confusions"], [])

    def test_sending_everything_to_the_bot(self):
        df = attach_costs(self.test, ["self_serve"] * len(self.test))
        m = score(df)
        self.assertIsNone(m["intent_accuracy"])  # queue-only, no intents to score
        self.assertEqual(m["security_recall"], 0.0)
        self.assertEqual(m["security_missed"], 240)
        self.assertEqual(m["automation_rate"], 1.0)
        # 240 security x 10, 1,240 other human x 3, 1,600 self-serve with no answer x 1
        expected = (240 * COST["security_missed"] + 1240 * COST["human_to_bot"]
                    + 1600 * COST["bot_wrong_answer"]) / 3080 * 1000
        self.assertAlmostEqual(m["harm_per_1000"], round(expected, 1))
        self.assertEqual(m["worst_confusions"][0]["true"], "payments")

    def test_harm_sources_add_up(self):
        df = attach_costs(self.test, ["self_serve"] * len(self.test))
        self.assertAlmostEqual(sum(score(df)["harm_by_source"].values()), 1.0, places=2)


if __name__ == "__main__":
    unittest.main()
