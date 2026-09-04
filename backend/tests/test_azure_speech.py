from django.test import SimpleTestCase

from backend.shared.infrastructure.ai.azure_speech import AzureSpeechProvider
from backend.shared.infrastructure.ai.base import AiProviderError


class AzureSpeechContentTypeTest(SimpleTestCase):
    def test_wav_and_pcm_map_to_16k_pcm(self):
        mapped = AzureSpeechProvider._content_type("audio/wav")
        self.assertEqual(mapped, "audio/wav; codecs=audio/pcm; samplerate=16000")
        self.assertEqual(
            AzureSpeechProvider._content_type("audio/L16;rate=16000"),
            "audio/wav; codecs=audio/pcm; samplerate=16000",
        )

    def test_ogg_opus_is_accepted(self):
        self.assertEqual(AzureSpeechProvider._content_type("audio/ogg"), "audio/ogg; codecs=opus")
        self.assertEqual(AzureSpeechProvider._content_type("audio/webm; codecs=opus"), "audio/ogg; codecs=opus")

    def test_aac_mp4_is_rejected(self):
        with self.assertRaises(AiProviderError):
            AzureSpeechProvider._content_type("audio/mp4")
        with self.assertRaises(AiProviderError):
            AzureSpeechProvider._content_type("audio/aac")
