export default function CharacterCreatePanel({ classesData, onCreate }) {
  const classEntries = Object.entries(classesData);

  return (
    <div className="max-w-3xl mx-auto bg-slate-800 border-2 border-blue-900 rounded-lg p-6 text-gray-100">
      <h2 className="text-2xl font-bold text-blue-300 mb-4">Create Character</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const name = form.get('name');
          const classKey = form.get('classKey');
          onCreate({ name, classKey });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm text-gray-300 mb-1">Name</label>
          <input
            name="name"
            required
            maxLength={20}
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white"
            placeholder="Enter a name"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Class</label>
          <select
            name="classKey"
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
          >
            {classEntries.map(([key, cls]) => (
              <option key={key} value={key}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Mode</label>
          <select
            name="mode"
            className="w-full bg-slate-700 border border-blue-900 rounded px-3 py-2 text-white capitalize"
          >
            <option value="normal">Normal</option>
            <option value="hardcore">Hardcore (death resets run)</option>
          </select>
        </div>
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded"
        >
          Create
        </button>
      </form>
    </div>
  );
}
