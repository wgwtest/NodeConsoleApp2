export default class BuffRegistry {
	constructor(definitions = {}) {
		this._raw = definitions;
	}

	setDefinitions(definitions = {}) {
		this._raw = definitions;
	}

	_clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	_buildParamValues(def, options = {}) {
		const values = Object.create(null);
		const schema = (def && def.paramsSchema && typeof def.paramsSchema === 'object') ? def.paramsSchema : {};

		for (const [key, spec] of Object.entries(schema)) {
			if (spec && Object.prototype.hasOwnProperty.call(spec, 'default')) {
				values[key] = spec.default;
			}
		}

		const overrides = (options && options.params && typeof options.params === 'object') ? options.params : {};
		for (const [key, value] of Object.entries(overrides)) {
			values[key] = value;
		}

		return values;
	}

	_resolveTemplates(node, values) {
		if (Array.isArray(node)) {
			return node.map(item => this._resolveTemplates(item, values));
		}

		if (!node || typeof node !== 'object') {
			if (typeof node !== 'string') return node;

			const direct = node.match(/^\$\{([^}]+)\}$/);
			if (direct) {
				const key = direct[1];
				return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : node;
			}

			return node.replace(/\$\{([^}]+)\}/g, (_, key) => {
				if (!Object.prototype.hasOwnProperty.call(values, key)) return `\${${key}}`;
				return String(values[key]);
			});
		}

		const out = {};
		for (const [key, value] of Object.entries(node)) {
			out[key] = this._resolveTemplates(value, values);
		}
		return out;
	}

	getDefinition(buffId, options = {}) {
		const def = this._raw ? this._raw[buffId] : null;
		if (!def) return null;

		// aliasOf 支持：允许 buff 定义复用另一条定义
		let resolved = def;
		if (resolved.aliasOf) {
			const aliased = this._raw[resolved.aliasOf];
			if (!aliased) return null;
			resolved = { ...aliased, id: resolved.id, name: resolved.name || aliased.name, type: resolved.type || aliased.type, tags: resolved.tags || aliased.tags };
		}

		const cloned = this._clone(resolved);
		const values = this._buildParamValues(cloned, options);
		return this._resolveTemplates(cloned, values);
	}
}
