# 🚀 Netlify Deployment Guide for Pokemon Pack Ripper

## Issues Fixed

### 1. ✅ Build Command
- **Before**: `npm run build` (incorrect - project uses Yarn)
- **After**: `yarn build` (correct)

### 2. ✅ Next.js Output Mode
- **Before**: `output: 'standalone'` (for Docker/self-hosted)
- **After**: Removed (default for Netlify)

### 3. ✅ Node Version
- Added explicit Node 18 requirement

---

## 🔧 Required Environment Variables in Netlify

You **MUST** add these environment variables in your Netlify dashboard:

1. Go to: `https://app.netlify.com/sites/pokepackripper/settings/env`
2. Add the following variables:

### Critical Variables:
```
MONGO_URL=<your-mongodb-connection-string>
DB_NAME=pokemon_pack_ripper
NEXT_PUBLIC_BASE_URL=https://pokepackripper.netlify.app
```

### Optional Variables:
```
NODE_ENV=production
```

---

## 📋 Deployment Checklist

### ✅ Already Done (Automated):
- [x] Changed build command from `npm` to `yarn`
- [x] Removed `standalone` output from next.config.js
- [x] Set Node version to 18
- [x] Configured Netlify Next.js plugin

### ⚠️ You Need to Do (Manual):

1. **Add Environment Variables** (see above section)
   - Without `MONGO_URL`, your app will fail to connect to database

2. **MongoDB Atlas Configuration**:
   - Make sure your MongoDB Atlas network access allows connections from anywhere (0.0.0.0/0)
   - Or whitelist Netlify's IP ranges

3. **Push Changes to GitHub**:
   - Use the "Save to Github" button in the chat interface
   - This will trigger a new Netlify deployment

4. **Check Netlify Build Logs**:
   - Go to: `https://app.netlify.com/sites/pokepackripper/deploys`
   - Click on the latest deployment
   - Check the build logs for any errors

---

## 🔍 Common Netlify Deployment Errors & Solutions

### Error: "Module not found: mongodb"
**Solution**: Environment variables missing. Add `MONGO_URL` in Netlify dashboard.

### Error: "Build failed - command not found"
**Solution**: Already fixed - changed to `yarn build`

### Error: "Cannot read property of undefined"
**Solution**: Check that all required environment variables are set.

### Error: "Function bundling failed"
**Solution**: Already fixed - removed `standalone` output mode.

---

## 📱 After Successful Deployment

Your app will be live at: `https://pokepackripper.netlify.app`

Test these critical features:
1. User signup/login
2. Pack opening
3. Pokemon Wilds
4. Trading system

---

## 🆘 If Deployment Still Fails

1. Check Netlify build logs at: `https://app.netlify.com/sites/pokepackripper/deploys`
2. Verify all environment variables are set
3. Make sure MongoDB is accessible from Netlify
4. Check that `NEXT_PUBLIC_BASE_URL` matches your Netlify URL

---

## 📝 Files Modified for Netlify

1. `/app/netlify.toml` - Build configuration
2. `/app/next.config.js` - Removed standalone output
3. `/app/package.json` - Already configured correctly with Yarn

All changes are ready to push!
