import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BigButton } from '../../components/BigButton';
import {
  canSaveDeviceContact,
  saveDeviceContact,
} from '../../features/contacts/contactService';
import {
  formatIndianPhoneNumber,
  sanitizeIndianPhoneInput,
  validateContactForm,
} from '../../features/contacts/contactValidation';

type SpeechRecognitionResultEvent = Event & {
  results: SpeechRecognitionResultList;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor():
  | BrowserSpeechRecognitionConstructor
  | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function CreateContactScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'error' | 'success' | 'info'>(
    'info',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const sanitizedPhone = useMemo(
    () => sanitizeIndianPhoneInput(phoneInput),
    [phoneInput],
  );
  const formattedPreview = useMemo(() => {
    if (!sanitizedPhone) return '+91';
    return formatIndianPhoneNumber(sanitizedPhone);
  }, [sanitizedPhone]);

  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  const supportsVoiceName = Boolean(SpeechRecognitionCtor);

  const showMessage = (tone: 'error' | 'success' | 'info', text: string) => {
    setMessageTone(tone);
    setMessage(text);
  };

  const handleVoiceInput = () => {
    if (!SpeechRecognitionCtor || isListening) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setName(transcript);
        setMessage('');
      }
    };

    recognition.onerror = () => {
      showMessage('error', 'Could not hear name. Please type it.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    setIsListening(true);
    recognition.start();
  };

  const handleSave = async () => {
    const validation = validateContactForm(name, sanitizedPhone);
    if (!validation.isValid) {
      showMessage('error', validation.message ?? 'Please check details');
      return;
    }

    setIsSaving(true);
    setMessage('');

    const result = await saveDeviceContact({
      name: name.trim(),
      phoneNumber: formatIndianPhoneNumber(sanitizedPhone),
    });

    setIsSaving(false);

    if (result.status === 'success') {
      setName('');
      setPhoneInput('');
      showMessage('success', 'Contact saved');
      return;
    }

    showMessage(
      result.status === 'permission_denied' ? 'error' : 'info',
      result.message,
    );
  };

  return (
    <div className="flex min-h-full flex-col gap-5">
      <button
        type="button"
        onClick={() => navigate('/parent')}
        className="w-fit rounded-2xl border border-teal-200 bg-white px-5 py-3 text-lg font-semibold text-teal-700 shadow-sm"
      >
        Back
      </button>

      <section className="rounded-[30px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Create Contact
        </p>
        <h2 className="mt-3 text-4xl font-bold text-slate-800">Add a phone contact</h2>
        <p className="mt-3 text-lg leading-relaxed text-slate-500">
          Enter the name and 10 digit mobile number.
        </p>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/95 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="space-y-6">
          <div>
            <label className="mb-3 block text-xl font-semibold text-slate-700">
              Name
            </label>
            <div className="flex items-stretch gap-3">
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setMessage('');
                }}
                placeholder="Enter name"
                className="min-h-[76px] flex-1 rounded-[24px] border-2 border-teal-100 bg-teal-50/40 px-5 text-2xl text-slate-800 outline-none transition focus:border-teal-500"
              />
              {supportsVoiceName ? (
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  disabled={isListening}
                  className="min-h-[76px] min-w-[88px] rounded-[24px] border-2 border-amber-200 bg-amber-50 px-4 text-lg font-bold text-amber-700 disabled:opacity-60"
                >
                  {isListening ? '...' : 'Mic'}
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-xl font-semibold text-slate-700">
              Phone Number
            </label>
            <div className="flex min-h-[76px] items-center rounded-[24px] border-2 border-teal-100 bg-teal-50/40 px-5">
              <span className="pr-4 text-2xl font-bold text-teal-700">+91</span>
              <input
                value={phoneInput}
                onChange={(event) => {
                  setPhoneInput(sanitizeIndianPhoneInput(event.target.value));
                  setMessage('');
                }}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="9876543210"
                className="w-full bg-transparent text-2xl text-slate-800 outline-none"
              />
            </div>
            <p className="mt-3 text-base text-slate-500">{formattedPreview}</p>
          </div>
        </div>
      </section>

      {message ? (
        <section
          className={`rounded-[28px] p-5 text-center text-2xl font-bold shadow-sm ${
            messageTone === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : messageTone === 'error'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700'
          }`}
        >
          {message}
        </section>
      ) : null}

      {!canSaveDeviceContact() ? (
        <p className="px-2 text-center text-base text-slate-500">
          Prototype demo: browsers cannot save directly to device contacts, but this flow shows the intended interaction.
        </p>
      ) : null}

      <div className="mt-auto pb-4">
        <BigButton
          onClick={handleSave}
          disabled={isSaving}
          className="!min-h-[88px] !rounded-[30px] !text-[1.7rem]"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </BigButton>
      </div>
    </div>
  );
}
