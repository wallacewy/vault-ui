import React, { PropTypes } from 'react';
import { Tabs, Tab } from 'material-ui/Tabs';
import { Toolbar, ToolbarGroup } from 'material-ui/Toolbar';
import Subheader from 'material-ui/Subheader';
import Paper from 'material-ui/Paper';
import Avatar from 'material-ui/Avatar';
import ActionAccountBox from 'material-ui/svg-icons/action/account-box';
import ActionDelete from 'material-ui/svg-icons/action/delete';
import ActionDeleteForever from 'material-ui/svg-icons/action/delete-forever';
import IconButton from 'material-ui/IconButton';
import { List, ListItem } from 'material-ui/List';
import sharedStyles from '../../shared/styles.css';
import styles from './radius.css';
import _ from 'lodash';
import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import { green500, green400, red500, red300, white } from 'material-ui/styles/colors.js'
import { callVaultApi, tokenHasCapabilities } from '../../shared/VaultUtils.jsx'
import PolicyPicker from '../../shared/PolicyPicker/PolicyPicker.jsx'
import { browserHistory } from 'react-router'


function snackBarMessage(message) {
    let ev = new CustomEvent("snackbar", { detail: { message: message } });
    document.dispatchEvent(ev);
}

class RadiusAuthBackend extends React.Component {
    static propTypes = {
        params: PropTypes.object.isRequired,
        location: PropTypes.object.isRequired
    };

    radiusUserSchema = {
        policies: [
            'default'
        ]
    }

    constructor(props) {
        super(props);

        this.state = {
            baseUrl: `/auth/radius/${this.props.params.namespace}/`,
            baseVaultPath: `auth/${this.props.params.namespace}`,
            userList: [],
            newUserId: '',
            newUserObject: {},
            selectedUserId: '',
            selectedUserObject: {},
            deleteUserId: '',
            openNewUserDialog: false,
            openEditUserDialog: false,
            openDeleteModal: false
        }

        _.bindAll(
            this,
            'loadUserList',
            'DeleteUser',
            'CreateUpdateUser'
        );
    }


    loadUserList() {
        tokenHasCapabilities(['list'], `${this.state.baseVaultPath}/users`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/users`, { list: true }, null, null)
                    .then((resp) => {
                        let userlist = _.map(resp.data.data.keys, (userid) => {
                            return { id: userid, path: `${this.state.baseVaultPath}/users/${userid}` };
                        })
                        this.setState({ userList: userlist });
                    })
                    .catch(snackBarMessage)
            })
            .catch(() => {
                this.setState({ userList: [] })
                snackBarMessage(new Error(`No permissions to list users`));
            })
    }

    displayUser() {
        tokenHasCapabilities(['read'], `${this.state.baseVaultPath}/users/${this.props.params.splat}`)
            .then(() => {
                callVaultApi('get', `${this.state.baseVaultPath}/users/${this.props.params.splat}`, null, null, null)
                    .then((resp) => {
                        this.setState({ selectedUserObject: resp.data.data, openEditUserDialog: true });
                    })
                    .catch(snackBarMessage)
            })
            .catch(() => {
                this.setState({ selectedUserObject: {} })
                snackBarMessage(new Error(`No permissions to display properties for user ${this.props.params.splat}`));
            })
    }

    componentDidMount() {
        if (this.props.params.splat) {
            this.setState({ selectedUserId: this.props.params.splat });
        } else {
            this.loadUserList();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (!_.isEqual(this.props.params.namespace, prevProps.params.namespace)) {
            // Reset
            this.setState({
                baseUrl: `/auth/radius/${this.props.params.namespace}/`,
                baseVaultPath: `auth/${this.props.params.namespace}`,
                userList: [],
                selectedUserId: ''
            });
        }

        if (this.state.selectedUserId != prevState.selectedUserId) {
            this.loadUserList()
            if (this.state.selectedUserId) {
                this.displayUser();
            }
        }
    }

    CreateUpdateUser(userid, userobj, create = false) {
        let fullpath = `${this.state.baseVaultPath}/users/${userid}`;
        let policiesStr = userobj.policies.join(',');
        callVaultApi('post', fullpath, null, { policies: policiesStr }, null)
            .then(() => {
                if (create) {
                    this.loadUserList();
                    this.setState({ openNewUserDialog: false, newUserId: '' });
                    snackBarMessage(`User ${userid} has been registered`);
                } else {
                    browserHistory.push(this.state.baseUrl);
                    this.setState({ openEditUserDialog: false, selectedUserId: '' });
                    snackBarMessage(`User ${userid} has been updated`);
                }
            })
            .catch(console.log.bind(console))
    }

    DeleteUser(userid) {
        let fullpath = `${this.state.baseVaultPath}/users/${userid}`;
        tokenHasCapabilities(['delete'], fullpath).then(() => {
            callVaultApi('delete', fullpath)
                .then(() => {
                    this.loadUserList();
                    this.setState({openDeleteModal: false, deleteUserId: ''})
                    snackBarMessage(`User ${userid} has been deleted`);
                })
                .catch(console.log.bind(console))
        }).catch(() => snackBarMessage("Permission denied"))

    }

    render() {
        let renderUserListItems = () => {
            return _.map(this.state.userList, (userobj) => {
                let avatar = (<Avatar icon={<ActionAccountBox />} />);
                let action = (
                    <IconButton
                        tooltip="Delete"
                        onTouchTap={() => {
                            if (window.localStorage.getItem("showDeleteModal") === 'false') {
                                this.DeleteUser(userobj.id);
                            } else {
                                this.setState({ openDeleteModal: true, deleteUserId: userobj.id })
                            }
                        }}
                    >
                        {window.localStorage.getItem("showDeleteModal") === 'false' ? <ActionDeleteForever color={red500} /> : <ActionDelete color={red500} />}
                    </IconButton>
                );

                let item = (
                    <ListItem
                        key={userobj.id}
                        primaryText={userobj.id}
                        insetChildren={true}
                        leftAvatar={avatar}
                        rightIconButton={action}
                        onTouchTap={() => {
                            this.setState({ newUserId: '' });
                            tokenHasCapabilities(['read'], userobj.path).then(() => {
                                this.setState({ selectedUserId: userobj.id });
                                browserHistory.push(`${this.state.baseUrl}${userobj.id}`);
                            }).catch(() => {
                                snackBarMessage(new Error("Access denied"));
                            })

                        }}
                    />
                )
                return item;
            });
        }

        let renderEditUserDialog = () => {
            const actions = [
                <FlatButton
                    label="Cancel"
                    primary={true}
                    onTouchTap={() => {
                        this.setState({ openEditUserDialog: false, selectedUserId: '' })
                        browserHistory.push(this.state.baseUrl);
                    }}
                />,
                <FlatButton
                    label="Save"
                    primary={true}
                    onTouchTap={() => {
                        this.CreateUpdateUser(this.state.selectedUserId, this.state.selectedUserObject, false)
                    }}
                />
            ];

            return (
                <Dialog
                    title={`Editing RADIUS user ${this.state.selectedUserId}`}
                    modal={false}
                    actions={actions}
                    open={this.state.openEditUserDialog}
                    onRequestClose={() => this.setState({ openEditUserDialog: false, selectedUserId: '' })}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <Subheader>Assigned Policies</Subheader>
                        <PolicyPicker
                            height="250px"
                            selectedPolicies={this.state.selectedUserObject.policies}
                            onSelectedChange={(policies) => {
                                let user = this.state.selectedUserObject;
                                user.policies = policies;
                                this.setState({ selectedUserObject: user });
                            }}
                        />
                    </List>
                </Dialog>
            );
        }

        let renderNewUserDialog = () => {
            let validateAndSubmit = () => {
                if (this.state.newUserId === '') {
                    snackBarMessage(new Error("User Name cannot be empty"));
                    return;
                }

                if (!_.every(this.state.userList, (k) => { return k.id != this.state.newUserId })) {
                    snackBarMessage(new Error("User already exists"));
                    return;
                }

                this.CreateUpdateUser(this.state.newUserId, this.state.newUserObject, true);
                this.setState({ openNewUserDialog: false, newUserId: '' });
            }

            const actions = [
                <FlatButton
                    label="Cancel"
                    primary={true}
                    onTouchTap={() => {
                        this.setState({ openNewUserDialog: false, newUserId: '' })
                    }}
                />,
                <FlatButton
                    label="Create"
                    primary={true}
                    onTouchTap={validateAndSubmit}
                />
            ];

            return (
                <Dialog
                    title={`Register new RADIUS user`}
                    modal={false}
                    actions={actions}
                    open={this.state.openNewUserDialog}
                    onRequestClose={() => this.setState({ openNewUserDialog: false, newUserId: '' })}
                    autoScrollBodyContent={true}
                >
                    <List>
                        <TextField
                            className={styles.textFieldStyle}
                            hintText="Enter the new user name"
                            floatingLabelFixed={true}
                            floatingLabelText="User Name"
                            fullWidth={false}
                            autoFocus
                            onChange={(e) => {
                                this.setState({ newUserId: e.target.value });
                            }}
                        />
                        <Subheader>Assigned Policies</Subheader>
                        <PolicyPicker
                            height="120px"
                            selectedPolicies={this.state.newUserObject.policies}
                            onSelectedChange={(policies) => {
                                let user = this.state.newUserObject;
                                user.policies = policies;
                                this.setState({ newUserObject: user });
                            }}
                        />
                    </List>
                </Dialog>
            );
        }

        let renderDeleteConfirmationDialog = () => {
            const actions = [
                <FlatButton label="Cancel" primary={true} onTouchTap={() => this.setState({ openDeleteModal: false, deleteUserId: '' })} />,
                <FlatButton label="Delete" style={{ color: white }} hoverColor={red300} backgroundColor={red500} primary={true} onTouchTap={() => this.DeleteUser(this.state.deleteUserId)} />
            ];

            return (
                <Dialog
                    title={`Delete Confirmation`}
                    modal={false}
                    actions={actions}
                    open={this.state.openDeleteModal}
                >

                    <p>You are about to permanently delete user {this.state.deleteUserId}.  Are you sure?</p>
                    <em>To disable this prompt, visit the settings page.</em>
                </Dialog>
            )
        }


        return (
            <div>
                {this.state.openEditUserDialog && renderEditUserDialog()}
                {this.state.openNewUserDialog && renderNewUserDialog()}
                {this.state.openDeleteModal && renderDeleteConfirmationDialog()}
                <Tabs>
                    <Tab label="Manage users" >
                        <Paper className={sharedStyles.TabInfoSection} zDepth={0}>
                            Here you can add, edit or delete users registred with this backend
                        </Paper>
                        <Paper className={sharedStyles.TabContentSection} zDepth={0}>
                            <Toolbar>
                                <ToolbarGroup firstChild={true}>
                                    <FlatButton
                                        primary={true}
                                        label="NEW USER"
                                        disabled={this.state.newSecretBtnDisabled}
                                        backgroundColor={green500}
                                        hoverColor={green400}
                                        labelStyle={{ color: white }}
                                        onTouchTap={() => {
                                            this.setState({
                                                openNewUserDialog: true,
                                                newUserId: '',
                                                newUserObject: this.radiusUserSchema
                                            })
                                        }}
                                    />
                                </ToolbarGroup>
                            </Toolbar>
                            <List className={sharedStyles.listStyle}>
                                {renderUserListItems()}
                            </List>
                        </Paper>
                    </Tab>
                </Tabs>
            </div>
        )
    }
}

export default RadiusAuthBackend;