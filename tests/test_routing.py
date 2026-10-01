import unittest

from sortcode.data import intents
from sortcode.routing import COST, QUEUE_OF, QUEUES, cost


class Mapping(unittest.TestCase):
    def test_every_intent_has_exactly_one_queue(self):
        placed = [i for members in QUEUES.values() for i in members]
        self.assertEqual(sorted(placed), sorted(intents()))
        self.assertEqual(len(placed), len(set(placed)))

    def test_queue_sizes_match_the_contract(self):
        sizes = {q: len(members) for q, members in QUEUES.items()}
        self.assertEqual(
            sizes,
            {"security": 6, "disputes": 8, "payments": 20, "account": 3, "self_serve": 40},
        )

    def test_no_typos_in_the_hand_written_lists(self):
        # A misspelt intent would silently fall through to self_serve.
        for queue, members in QUEUES.items():
            for intent in members:
                self.assertIn(intent, intents(), f"{intent!r} in {queue} is not a real intent")


class Costs(unittest.TestCase):
    def test_right_answer_is_free(self):
        self.assertEqual(cost("compromised_card", "security"), 0)
        self.assertEqual(cost("declined_card_payment", "payments"), 0)
        self.assertEqual(cost("exchange_rate", "self_serve", "exchange_rate"), 0)

    def test_missed_fraud_is_the_worst_outcome(self):
        self.assertEqual(cost("compromised_card", "self_serve", "card_not_working"), COST["security_missed"])
        self.assertEqual(cost("lost_or_stolen_card", "payments"), COST["security_missed"])
        self.assertEqual(COST["security_missed"], max(COST.values()))

    def test_real_problem_sent_to_the_bot(self):
        self.assertEqual(cost("failed_transfer", "self_serve", "transfer_timing"), COST["human_to_bot"])

    def test_bounced_between_human_teams(self):
        self.assertEqual(cost("request_refund", "payments"), COST["human_to_wrong_human"])
        self.assertEqual(cost("request_refund", "security"), COST["human_to_wrong_human"])

    def test_self_serve_needs_the_right_answer(self):
        self.assertEqual(cost("change_pin", "self_serve", "activate_my_card"), COST["bot_wrong_answer"])
        # Queue-only approaches can't name an answer at all.
        self.assertEqual(cost("change_pin", "self_serve"), COST["bot_wrong_answer"])

    def test_faq_landing_on_people(self):
        self.assertEqual(cost("exchange_rate", "security"), COST["bot_to_security"])
        self.assertEqual(cost("exchange_rate", "payments"), COST["bot_to_human"])

    def test_inside_a_human_queue_the_exact_intent_doesnt_matter(self):
        self.assertEqual(QUEUE_OF["pending_transfer"], QUEUE_OF["failed_transfer"])
        self.assertEqual(cost("pending_transfer", "payments", "failed_transfer"), 0)


if __name__ == "__main__":
    unittest.main()
